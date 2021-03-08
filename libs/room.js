var ENV = process.env.NODE_ENV || "development";
var DEBUG = ENV === "development";

var constants = require("../public/shared/constants");
var utils = require("../public/shared/utils");

const FAILED_SECOND_DISPLAY_SEC = 3;
const FAILED_VOTE_DISPLAY_SEC = 5;
const PASS_DISPLAY_SEC = 2;
const SHOW_RESULT_DISPLAY_SEC = 5;

const DEMON_SELECTION_MSG = "A demonic presence is arising at the table...";
const NIGHT_PLAYER_MSG = "Night falls, the demon is possessing a victim...";
const NIGHT_DEMON_MSG = "Select a victim to add to your minions!";
const DISCUSS_PLAYER_MSG = "Make a plan to free your fellows and defeat the demon!";
const DISCUSS_DEMON_MSG = "The human worms are plotting against you. Make a plan with your minions!";
const DAY_PLAYER_MSG = "Use these tools to purge the evil from your midst!";
const DAY_DEMON_MSG = "Coordinate with your minions to foil the humans' plans!";
const PLAYER_WIN_MESSAGE = "The demon's presence has been purged! Sadly it took some of us with it...";
const DEMON_WIN_MESSAGE = "The demon has possessed half of the players! You have fallen to darkness!";

const ITEM_PROPOSE_MSG = {
	[constants.items.BOARD]: "consult the spirit board",
	[constants.items.WATER]: "use holy water",
	[constants.items.ROD]: "use the divining rod",
	[constants.items.EXORCISM]: "perform an exorcism",
	[constants.items.SALT]: "draw a salt line",
	[constants.items.SMUDGE]: "use a smudge stick",
};
const ITEM_USE_MSG = {
	[constants.items.BOARD]: "consulting with the spirits about",
	[constants.items.WATER]: "using holy water on",
	[constants.items.ROD]: "using the divining rod to test",
	[constants.items.EXORCISM]: "performing an exorcism on",
	[constants.items.SALT]: "waiting for the salt line to take effect",
	[constants.items.SMUDGE]: "using a smudge stick to ward"
};

class Room {
    constructor(io, code, settings, storeCallback, deleteCallback) {
        this.io = io;
        this.code = code;
        this.sockets = {};
        this.socketToId = {};

        this.storeCallback = storeCallback;
        this.deleteCallback = deleteCallback;

        this.eventHandlers = {
            "leave table": this.leaveTable,
            "do move": this.handleMove,
            "chat msg": this.sendMessage,
            "update settings": this.updateSettings,
            "update player settings": this.updatePlayer,
        };

        // Public data
        this.state = constants.states.LOBBY;
        this.round = 0;
        this.paused = false;
        
        this.players = [];
        this.message = undefined;
        this.demonMessage = undefined;

        this.resources = {};
        this.timers = {};
        this.saltLine = {start: undefined, end: undefined};

        this.demonId = undefined;

        this.currentMove = undefined;
        this.currentPlayer = undefined;
        this.startPlayer = undefined;

        // May not provide settings if restoring.
        if (settings) this._updateSettings(settings);
        this.showCode = true;

        // Private data
        this.possessedPlayers = [];
        this.damnedPlayers = [];
        this.votes = {};
        
        this.smudgedPlayer = undefined;
        
        this.interfereUses = {};
        this.doInterfere = false;
        this.anyInterfere = false;
        this.saltFlip = undefined;

        this.demonCandidates = [];
        this.demonCandidate = undefined;

        this.rodResult = undefined;
        this.rodDisplay = undefined;
        
        this.timerInfo = {};
        this.roundTimedOut = undefined;

        // Chat
        this.generalChat = [];
        this.demonChats = {};
    }

    restore(state) {
        Object.assign(this, state);
    
        // Pause game until manually unpaused.
        this.paused = true;
        this.pauseTime = this.pauseTime || this.saveTime;

        // Mark players at inactive when restored, players will be activated as restored.
        this.players.forEach(p => p.active = false);
    }

    toJSON() {
        return {
            // Settings
            settings: this.settings,
            itemsInUse: this.itemsInUse,
            code: this.code,
            showCode: this.showCode,
            // Game data
            state: this.state,
            round: this.round,
            players: this.players,
            demonId: this.demonId,
            // Display data
            message: this.message,
            demonMessage: this.demonMessage,
            timers: this.timers,
            paused: this.paused,
            pauseTime: this.pauseTime,
            // Moves
            resources: this.resources,
            saltLine: this.saltLine,
            currentMove: this.currentMove,
            // Turn order
            currentPlayer: this.currentPlayer,
            startPlayer: this.startPlayer,
            // Private data
            possessedPlayers: this.possessedPlayers,
            damnedPlayers: this.damnedPlayers,
            votes: this.votes,
            smudgedPlayer: this.smudgedPlayer,
            interfereUses: this.interfereUses,
            doInterfere: this.doInterfere,
            saltFlip: this.saltFlip,
            rodResult: this.rodResult,
            rodDisplay: this.rodDisplay,
            // Internal data
            demonCandidates: this.demonCandidates,
            demonCandidate: this.demonCandidate,
            roundTimedOut: this.roundTimedOut,
            // Chat
            generalChat: this.generalChat,
            demonChats: this.demonChats,
            // Restore data
            timerInfo: this.timerInfo,
            saveTime: Date.now(),
        }
    }

    static validatePlayer(socket, settings) {
        if (!settings) {
            socket.emit("server error", "Must provide player settings!");
            return false;
        }
        if (!settings.name) {
            socket.emit("server error", "Must provide player name!");
            return false;
        }
        if (!settings.name.match("^[\\d\\w\\s!]+$")) {
            socket.emit("server error", `Invalid name: '${settings.name.trim()}', alphanumeric only!`);
            return false;
        }
        return true;
    }

    addPlayer(socket, id, settings) {
        let player = this.getPlayer(id);
        if (!player) return this.addNewPlayer(socket, id, settings);
        else this.markPlayerActive(socket, player);
        return true;
    }

    addNewPlayer(socket, id, settings) {
        // Allow new player to replace existing, inactive player.
        let existing = this.players.find(p => p.name.toLowerCase().trim() === settings.name.toLowerCase().trim());
        if (existing && existing.active) {
            socket.emit("server error", `Player with name '${settings.name}' already exists at table ${this.code}`);
            return false;
        }
        if (existing) {
            // Need to replace any inflight id references here.
            if (this.currentMove && this.currentMove.playerId === existing.id) this.currentMove.playerId = id;
            if (this.demonCandidate === existing.id) this.demonCandidate = id;
            if (this.possessedPlayers.includes(existing.id)) {
                utils.removeByValue(this.possessedPlayers, existing.id);
                this.possessedPlayers.push(id);
                this.emit(this.demonId, "possessed players", this.possessedPlayers);
                this.demonChats[id] = this.demonChats[existing.id];
                delete this.demonChats[existing.id];
            }
            existing.id = id;
            this.markPlayerActive(socket, existing);
            return true;
        }

        // Otherwise, this is a truly new player.
        if (!settings) {
            socket.emit("server error", `Tried rejoining table ${this.code} but no player settings provided!`);
            return false;
        }
        if (this.players.length >= this.settings.maxPlayers) {
            socket.emit("server error", `Table ${this.code} full!`);
            return false;
        }
        if (this.state !== constants.states.LOBBY) {
            socket.emit("server error", `Table ${this.code} game in progress!`);
            return false;
        }
        
        this.addSocket(socket, id);
        this.players.push({
            name: settings.name,
            color: this.getAvailableColor(settings.color),
            avatarId: (settings.avatarId || settings.avatarId === 0) ? settings.avatarId : Math.floor(Math.random() * constants.AVATAR_COUNT),
            id: id,
            active: true,
            isDemon: false,
            move: undefined,
            voted: false,
        });
        this.updateTable();
        this.generalChat.map(l => socket.emit("chat msg", l.msg, l.sender));
        return true;
    }

    markPlayerActive(socket, player) {
        player.active = true;
        this.addSocket(socket, player.id);

        // Update private state
        if (player.isDemon) {
            this.emit(player.id, "possessed players", this.possessedPlayers);
            this.emit(player.id, "update interfere", this.interfereUses);
            this.emit(player.id, "smudged player", this.smudgedPlayer);
        }
        if (this.possessedPlayers.includes(player.id)) {
            this.emit(player.id, "possession", true);
        }
        // Update public state
        this.updateTable();
        // Update chats
        this.generalChat.map(l => this.emit(player.id, "chat msg", l.msg, l.sender));
        if (player.isDemon) for (const id in this.demonChats) this.demonChats[id].map(l => this.emit(player.id, "demon msg", l.msg, id));
        if (this.possessedPlayers.includes(player.id)) this.demonChats[player.id].map(l => this.emit(player.id, "demon msg", l.msg));
    }

    /**
     * Removes a player the table. 
     * If a game is in progress, marks the player as inactive, otherwise removes player completely.
     * 
     * @param {socket}   Associated socket.
     * @param {uuid}     Player id  
     * @return {Boolean} True if player was removed from room, false otherwise.
     */
    removePlayer(socket, id) {
        let player = this.getPlayer(id);
        if (!player) return true;
        if (this.state === constants.states.LOBBY) return this.leaveTable(id);
        if (player.active) this.markPlayerInactive(player);
        return false;
    }

    leaveTable(id) {
        if (this.state !== constants.states.LOBBY) {
            this.emit(id, "server error", "Can not leave table while a game is in progress!");
            return false;
        }
        this.emit(id, "clear state");
        this.removeSocket(id);
        utils.removeByValue(this.players, this.players.find(p => p.id === id));
        this.updateTable();
        if (this.empty()) this.deleteCallback();
        return true;
    }

    markPlayerInactive(player) {
        player.active = false;
        this.removeSocket(player.id);
        this.updateTable();
    }

    addSocket(socket, id) {
        this.sockets[id] = socket;
        this.socketToId[socket.id] = id;
        socket.join(this.code);
        Object.entries(this.eventHandlers).forEach(([event, callback]) => {
            socket.on(event, function(...args) { 
                const id = this.socketToId[socket.id];
                if (id) callback.bind(this)(id, ...args);
            }.bind(this));
        });
        this.emit(id, "player id", id);
        this.emit(id, "init settings", { code_version: process.env.npm_package_version });
    }

    removeSocket(id) {
        const socket = this.sockets[id];
        delete this.sockets[id];
        if (!socket) return;
        delete this.socketToId[socket.id];
        socket.leave(this.code);
        socket.emit("update state");
        Object.keys(this.eventHandlers).forEach(event => socket.removeAllListeners(event));
    }

    empty() {
        return this.players.length === 0;
    }

    active() {
        return this.players.reduce((acc, p) => acc || p.active, false);
    }

    async updateTable() {
        // Send public data to the players.
        this.broadcast("update state", {
            // Settings
            settings: this.settings,
            itemsInUse: this.itemsInUse,
            code: this.code,
            showCode: this.showCode,
            // Game data
            state: this.state,
            round: this.round,
            players: this.players,
            demonId: this.demonId,
            // Display data
            message: this.message,
            demonMessage: this.demonMessage,
            timers: this.timers,
            paused: this.paused,
            pauseTime: this.pauseTime,
            // Moves
            resources: this.resources,
            saltLine: this.saltLine,
            currentMove: this.currentMove,
            // Turn order
            currentPlayer: this.currentPlayer,
            startPlayer: this.startPlayer,
        });
        if (this.storeCallback) await this.storeCallback(this.toJSON());
    }

    emit(id, event, ...args) {
        if (id in this.sockets) this.sockets[id].emit(event, ...args)
    }

    broadcast(...args) {
        this.io.to(this.code).emit(...args);
    }

    sendMessage(id, msg, targetId) {
        if (this.isDemon(id)) {
            if (!targetId) return;
            this.sendDemonMessage(msg, targetId);
        } else {
            this.broadcastMessage(msg, this.getPlayer(id).name);
        }
    }

    broadcastMessage(msg, sender) {
	    this.broadcast("chat msg", msg, sender);
        this.generalChat.push({msg: msg, sender: sender});
    }

    sendDemonMessage(msg, id) {
        const targetPlayer = this.getPlayer(id);
        if (!targetPlayer) return;
        this.emit(id, "demon msg", msg);
        this.emit(this.demonId, "demon msg", msg, id);
        this.demonChats[id].push({msg: msg});
    }

    clearChats() {
        this.broadcast("clear chat", "player-chat");
        this.broadcast("clear chat", "game-log");
        this.broadcast("clear chat", "demon-chat");
        this.generalChat = [];
        this.demonChats = {};
    }

    updatePlayer(id, settings) {
        let player = this.getPlayer(id);
        if (settings.color) player.color = this.getAvailableColor(settings.color);
        if (settings.avatarId) player.avatarId = settings.avatarId;
        this.updateTable();
    }

    updateSettings(id, settings) {
        if (!this.isOwner(id)) {
            this.emit(id, "server error", "Only owner can modify table settings!");
            return;
        }
        this._updateSettings(settings);
    }

    _updateSettings(settings) {
        this.settings = settings;
        this.itemsInUse = Object.keys(this.settings.items).filter(item => this.settings.items[item]);
        this.updateTable();
    }

    handleMove(id, move) {
        if (this.isOwner(id) && this.handleOwnerMove(move)) {
            this.updateTable();
            return;
        }
        let result = this.isDemon(id) ? this.handleDemonMove(move) : this.handlePlayerMove(id, move);
        if (result.advance) {
            this.advanceState();
        } else if (result.handled) {
            this.updateTable();
        } else {
            console.error(`Move not handled! State: ${this.state}, move: ${move}`);
        }
    }

    handleOwnerMove(move) {

        switch (move.type) {
            case constants.moves.PAUSE:
                if (this.paused) {
                    // Restart timers
                    if (this.timerInfo[constants.timers.ROUND]) this.autoAdvanceRound(this.timerInfo[constants.timers.ROUND].duration - (this.pauseTime - this.timerInfo[constants.timers.ROUND].start) / 1000);
                    if (this.timerInfo[constants.timers.MOVE]) this.autoAdvanceState(this.timerInfo[constants.timers.MOVE].duration - (this.pauseTime - this.timerInfo[constants.timers.MOVE].start) / 1000, this.timerInfo[constants.timers.MOVE].display);
                } else {
                    // Clear timeouts
                    for (var timer in constants.timers) if (this.timerInfo[timer]) clearTimeout(this.timerInfo[timer].id);
                    //if (this.timerInfo[constants.timers.ROUND]) clearTimeout(this.timerInfo[constants.timers.ROUND].id);
                    //if (this.timerInfo[constants.timers.MOVE]) clearTimeout(this.timerInfo[constants.timers.MOVE].id);
                }
                this.paused = !this.paused;
                this.pauseTime = this.paused ? Date.now() : undefined;
                return true;
            case constants.moves.SHOW_CODE:
                this.showCode = !this.showCode;
                return true;
            default:
                return false;
        }
    }

    handleDemonMove(move) {
        var result = {
            handled: false,
            advance: false,
        };
        switch (this.state) {
            case constants.states.LOBBY: {
                break;
            }
            case constants.states.DEMON_SELECTION: {
                break;
            }
            case constants.states.NIGHT: {
                if (move.type !== constants.moves.SELECT) return result;
                if (this.smudgedPlayer === move.targetId) return result;
                let targetTablePlayer = this.getPlayer(move.targetId);
                if (targetTablePlayer.isPurified) return result;
                let success = this.possessPlayer(move.targetId, true);
                result.handled = success;
                result.advance = success;
                break;
            }
            case constants.states.DISCUSS: {
                break;
            }
            case constants.states.DAY: {
                break;
            }
            case constants.states.SECONDING: {
                break;
            }
            case constants.states.VOTING: {
                break;
            }
            case constants.states.SELECT: {
                break;
            }
            case constants.states.INTERFERE: {
                if (move.type !== constants.moves.INTERFERE) return result;
                if (!this.interfereUses[this.currentMove.type]) return;
                this.doInterfere = move.saltFlip ? (move.saltFlip[0] || move.saltFlip[1]) : move.vote;
                this.saltFlip = move.saltFlip;
                result.handled = true;
                // We do not advance round, this is handled by timer
                break;
            }
            case constants.states.DISPLAY: {
                break;
            }
            case constants.states.END: {
                break;
            }
        }
        return result;
    }

    handlePlayerMove(id, move) {
        var result = {
            handled: false,
            advance: false,
        };
        let tablePlayer = this.getPlayer(id);
        switch (this.state) {
            case constants.states.LOBBY: {
                if (move.type !== constants.moves.BEGIN) return result;
                if (!this.isOwner(id)) return result;
                if (this.players.length < this.settings.minPlayers) {
                    this.emit(id, "server error", `Cannot being game with less than ${this.settings.minPlayers} players!`);
                    return result;
                }
                if (this.players.length > this.settings.maxPlayers) {
                    this.emit(id, "server error", `Cannot being game with more than ${this.settings.maxPlayers} players!`);
                    return result;
                }
                result.handled = true;
                result.advance = true;
                break;
            }
            case constants.states.DEMON_SELECTION: {
                if (move.type !== constants.moves.ACCEPT_DEMON) return result;
                if (id !== this.demonCandidate) return result;
                result.handled = true;
                result.advance = move.accept;
                if (move.accept) {
                    this.demonCandidates = undefined;
                    this.demonCandidate = undefined;

                    tablePlayer.isDemon = true;
                    this.demonId = id;

                    // TODO: make update table emit demonState to demon, remove this.
                    this.emit(this.demonId, "update interfere", this.interfereUses);
                    this.broadcastMessage(`<c>${tablePlayer.name}</c> is the demon!`);
                } else {
                    this.selectDemonCandidate();
                }
                break;
            }
            case constants.states.NIGHT: {
                break;
            }
            case constants.states.DISCUSS: {
                if (move.type != constants.moves.READY) return result;

                this.votes[tablePlayer.name] = true;

                result.handled = true;
                result.advance = Object.keys(this.votes).length === this.players.length - 1;
                break;
            }
            case constants.states.DAY: {
                if (!(move.type === constants.moves.PASS || move.type === constants.moves.USE_ITEM && this.itemsInUse.includes(move.item))) return result;
                // If using turn order, only current player can move.
                if (this.settings.turnOrder && this.getCurrentPlayer().id !== id) return result;
                // Player has already moved this round.
                if (tablePlayer.move) return result;
                // Resource not available.
                if (this.resources[move.item] < 1) return result;

                // Store move.
                result.handled = true;
                if (move.type === constants.moves.PASS) {
                    tablePlayer.move = {type: constants.moves.PASS, success: true};
                    // If using turn order, always advance. Otherwise, if player passed, check for round end.
                    if (!this.settings.turnOrder && this.players.find(p => p.move === undefined && !p.isDemon)) return result;
                } else {
                    tablePlayer.move = {type: move.item};
                    this.currentMove = {
                        type: move.item,
                        playerId: tablePlayer.id,
                        playerName: tablePlayer.name,
                    };
                }
                result.advance = true;
                break;
            }
            case constants.states.SECONDING: {
                if (move.type !== constants.moves.SECOND) return result;
                if (id === this.currentMove.playerId) return result;
                if (tablePlayer.isExorcised) return result;

                tablePlayer.voted = true;
                this.votes[tablePlayer.name] = move.vote;
                            
                // Advance if any player voted yes, or if all player have voted.
                result.handled = true;
                if (!move.vote && this.players.find(p => !(p.id === this.currentMove.playerId || p.isExorcised || p.voted || p.isDemon))) return result;
                result.advance = true;
                break;
            }
            case constants.states.VOTING: {
                if (move.type !== constants.moves.VOTE) return result;
                if (tablePlayer.isExorcised) return result;

                tablePlayer.voted = true;
                this.votes[tablePlayer.name] = move.vote;
                
                // If all non-demon players have voted, advance round.
                result.handled = true;
                if (this.players.find(p => !(p.voted || p.isDemon || p.isExorcised))) return result;
                result.advance = true;
                break;
            }
            case constants.states.SELECT: {
                if (move.type !== constants.moves.SELECT) return result;
                if (id !== this.currentMove.playerId) return result;
                if (this.currentMove.type === constants.items.SALT) {
                    // Player first selects salt line (shows to all users), then submit separately.
                    if (move.line) {
                        // Validate player input
                        if (move.line.start === undefined || move.line.start < 0 || move.line.start > this.players.length - 1) move.line.start = undefined;
                        if (move.line.end === undefined || move.line.end < 0 || move.line.end > this.players.length - 1) move.line.end = undefined;
                        if (move.line.start !== undefined && move.line.end !== undefined) {
                            for (var i = -1; i <= 1; i++) {
                                if ((move.line.start + i).mod(this.players.length - 1) === move.line.end) move.line.end = undefined;
                            }
                        }
                        this.saltLine = move.line;
                        result.handled = true;
                        return result;
                    } else {
                        if (this.saltLine.start === undefined || this.saltLine.end === undefined) return result;
                        this.currentMove.targetId = undefined;
                        this.currentMove.targetName = "";
                    }
                } else {
                    // Player cannot select themself.
                    if (id === move.targetId) return result;
                    this.currentMove.targetId = move.targetId;
                    this.currentMove.targetName = this.getPlayer(move.targetId).name;
                }
                result.handled = true;
                result.advance = true;
                break;
            }
            case constants.states.INTERPRET: {
                if (move.type !== constants.moves.INTERPRET) return result;
                if (id !== this.currentMove.playerId) return result;
                this.rodDisplay = move.choice;
                result.handled = true;
                // We do not advance round, this is handled by timer
            }
            case constants.states.INTERFERE: {
                break;
            }
            case constants.states.DISPLAY: {
                break;
            }
            case constants.states.END: {
                if (move.type !== constants.moves.FINISH || !this.isOwner(id)) return result;
                result.handled = true;
                result.advance = true;
                break;
            }
        }
        return result;
    }

    advanceState() {
        this.clearTimer(constants.timers.MOVE);

        switch (this.state) {
            // Start game.
            case constants.states.LOBBY: {
                this.handleNewGame();
                this.message = DEMON_SELECTION_MSG;
                this.state = constants.states.DEMON_SELECTION;
                break;
            }
            case constants.states.DEMON_SELECTION: {
                this.handleNewRound();
                break;
            // Move to day time
            } 
            case constants.states.NIGHT: {
                this.state = constants.states.DISCUSS;
                this.message = DISCUSS_PLAYER_MSG;
                this.demonMessage = DISCUSS_DEMON_MSG;

                // Clear over-night protection.
                this.smudgedPlayer = undefined;
                this.emit(this.demonId, "smudged player");

                this.players.forEach(player => {
                    player.isSmudged = false;
                    player.isPurified = false;
                });

                this.autoAdvanceState(this.settings.times[constants.times.DISCUSS], true);
                break;
            }
            case constants.states.DISCUSS: {
                this.clearVotes();
                this.state = constants.states.DAY;

                if (this.settings.turnOrder) {
                    this.currentPlayer = this.startPlayer;
                    this.message = `It is ${this.getCurrentPlayer().name}'s turn to select a tool`;
                    this.demonMessage = undefined;
                    this.broadcastMessage(`It is <c>${this.getCurrentPlayer().name}</c>'s turn to select a tool`);
                    this.autoAdvanceState(this.settings.times[constants.times.TURN], true);
                } else {
                    this.message = DAY_PLAYER_MSG;
                    this.demonMessage = DAY_DEMON_MSG;
                    this.autoAdvanceRound();
                }
                break;
            }
            // Handle a player move, either ask for second or move to night.
            case constants.states.DAY: {
                this.demonMessage = undefined;
                this.clearVotes();
                if (this.currentMove) {
                    this.state = constants.states.SECONDING;
                    this.message = `${this.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[this.currentMove.type]}, second?`;
                    this.broadcastMessage(`<c>${this.currentMove.playerName}</c> wants to ${ITEM_PROPOSE_MSG[this.currentMove.type]}, second?`);
                    this.autoAdvanceState(this.settings.times[constants.times.SECOND], true);
                } else if (this.settings.turnOrder) {
                    this.state = constants.states.DISPLAY;
                    let currentPlayer = this.getCurrentPlayer();
                    this.message = `${currentPlayer.name} ${currentPlayer.move ? "passes": "ran out of time"}`; 
                    this.broadcastMessage(`<c>${currentPlayer.name}</c> ${currentPlayer.move ? "passes": "ran out of time"}`);
                    currentPlayer.move = {type: constants.moves.PASS};
                    this.autoAdvanceState(PASS_DISPLAY_SEC);
                } else {
                    this.state = constants.states.DISPLAY;
                    this.message = "All players have made their move, night is falling...";
                    this.clearTimer(constants.timers.ROUND);
                    this.autoAdvanceState(constants.ROUND_OVER_DISPLAY_SEC);
                }
                break;
            }   
            // Move to voting or back to day
            case constants.states.SECONDING: {
                const tally = this.tallyVotes();
                if (tally[true].length > 0) {
                    this.state = constants.states.VOTING;
                    this.message = `${this.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[this.currentMove.type]} and ${tally[true][0]} seconded. Vote now.`;
                    this.broadcastMessage(`<c>${tally[true][0]}</c> seconds <c>${this.currentMove.playerName}</c>'s proposal`);
                    this.autoAdvanceState(this.settings.times[constants.times.VOTE], true);
                } else {
                    this.state = constants.states.DISPLAY;
                    this.message = `No player seconds ${this.currentMove.playerName}'s proposal`
                    this.broadcastMessage(`No player seconds <c>${this.currentMove.playerName}</c>'s proposal`);
                    let tablePlayer = this.getPlayer(this.currentMove.playerId);
                    tablePlayer.move.success = false;
                    this.autoAdvanceState(FAILED_SECOND_DISPLAY_SEC);
                }
                this.clearVotes();
                break;
            }
            // Move to player select or back to day
            case constants.states.VOTING: {
                const tally = this.tallyVotes(true);
                const success = tally[true].length >= tally[false].length;
                const tallyStr = `${tally[true].length}-${tally[false].length}-${tally[undefined].length}`;
                if (success) {
                    this.state = constants.states.SELECT;
                    let action = this.currentMove.type === constants.items.SALT ? "draw a line" : "select a target";
                    this.message = `The vote succeeds ${tallyStr}. ${this.currentMove.playerName} will now ${action}.`;
                    this.broadcastMessage(`The vote succeeds ${tallyStr}.`);
                    this.autoAdvanceState(this.settings.times[constants.times.SELECT], true);
                } else {
                    this.state = constants.states.DISPLAY;
                    this.message = `The vote fails ${tallyStr}`;
                    this.broadcastMessage(`The vote fails ${tallyStr}.`);
                    this.autoAdvanceState(FAILED_VOTE_DISPLAY_SEC);
                }
                this.getPlayer(this.currentMove.playerId).move.success = success;
                if (tally[true].length > 0) this.broadcastMessage(`Yes: ${tally[true].map(p => `<c>${p}</c>`).join(", ")}`);
                if (tally[false].length > 0) this.broadcastMessage(`No: ${tally[false].map(p => `<c>${p}</c>`).join(", ")}`);
                if (tally[undefined].length > 0) this.broadcastMessage(`Abstain: ${tally[undefined].map(p => `<c>${p}</c>`).join(", ")}`);
                break;
            }
            // Move to display result
            case constants.states.SELECT: {
                this.state = constants.states.DISPLAY;

                if (this.currentMove.targetId || (this.saltLine.start !== undefined && this.saltLine.end !== undefined)) {
                    let target = this.currentMove.targetName ? ` ${this.currentMove.targetName}` : "";
                    this.message = `${this.currentMove.playerName} is ${ITEM_USE_MSG[this.currentMove.type]}${target}.`;
                    this.broadcastMessage(`<c>${this.currentMove.playerName}</c> is ${ITEM_USE_MSG[this.currentMove.type]}<c>${target}</c>.`);
                    this.resources[this.currentMove.type] -= 1;

                    switch (this.currentMove.type) {
                        case constants.items.WATER:
                            this.possessPlayer(this.currentMove.targetId, false);
                            let targetTablePlayer = this.getPlayer(this.currentMove.targetId);
                            targetTablePlayer.isPurified = this.settings.waterPurify;
                            break;
                        case constants.items.BOARD:
                        case constants.items.ROD:
                        case constants.items.EXORCISM:
                        case constants.items.SALT:
                        case constants.items.SMUDGE:
                            this.state = constants.states.INTERFERE;
                            break;
                    }
                } else {
                    let action = this.currentMove.type === constants.items.SALT ? "complete a line" : "select a target";
                    this.message = `${this.currentMove.playerName} failed to ${action} and forfeits their move.`;
                    this.broadcastMessage(`<c>${this.currentMove.playerName}</c> failed to ${action} and forfeits their move.`);
                    let tablePlayer = this.getPlayer(this.currentMove.playerId);
                    if (tablePlayer) tablePlayer.move.success = false;
                }
                if (this.state === constants.states.INTERFERE) {
                    this.autoAdvanceState(this.settings.times[constants.times.INTERFERE], true);
                } else {
                    this.autoAdvanceState(SHOW_RESULT_DISPLAY_SEC);
                }
                break;
            }
            case constants.states.INTERFERE: {
                this.state = constants.states.DISPLAY;

                if (this.doInterfere) { 
                    this.anyInterfere = true;
                    this.interfereUses[this.currentMove.type] -= 1;
                    this.emit(this.demonId, "update interfere", this.interfereUses);
                }

                switch (this.currentMove.type) {
                    case constants.items.BOARD: {
                        var is = this.possessedPlayers.includes(this.currentMove.targetId);
                        if (this.doInterfere) is = !is;
                        this.message = `The board reveals that ${this.currentMove.targetName} ${is ? "IS" : "IS NOT"} possessed`;
                        this.broadcastMessage(`The board reveals that <c>${this.currentMove.targetName}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
                        break;
                    }
                    case constants.items.ROD: {
                        this.state = constants.states.INTERPRET;
                        let is = this.possessedPlayers.includes(this.currentMove.targetId);
                        if (this.doInterfere) is = !is;
                        this.rodResult = is;
                        this.rodDisplay = undefined;
                        this.message = `${this.currentMove.playerName} is interpreting the results of the divining rod`;
                        this.emit(this.currentMove.playerId, "rod", is);
                        break;
                    }
                    case constants.items.EXORCISM: {
                        var is = this.possessedPlayers.includes(this.currentMove.targetId);
                        if (this.doInterfere) is = !is;
                        this.message = `It appears that ${this.currentMove.targetName} ${is ? "IS" : "IS NOT"} possessed`;
                        this.broadcastMessage(`It appears that <c>${this.currentMove.targetName}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
                        if (!this.doInterfere) this.possessPlayer(this.currentMove.targetId, false);

                        let targetTablePlayer = this.getPlayer(this.currentMove.targetId);
                        targetTablePlayer.isExorcised = true;
                        if (!targetTablePlayer.move) targetTablePlayer.move = {type: constants.moves.PASS};
                        this.emit(targetTablePlayer.id, "pop up", "You are unconscious until tomorrow, do not speak!");
                        break;
                    }
                    case constants.items.SALT: {
                        // Collect salt groups.
                        var groups = [[], []];
                        this.saltLine.result = [false, false];
                        var currGroup = this.saltLine.start < this.saltLine.end ? 1 : 0;
                        var pastDemon = false;
                        for (var i = 0; i < this.players.length; i++) {
                            if (this.players[i].isDemon) {
                                pastDemon = true;
                                continue;
                            }
                            groups[currGroup].push(this.players[i].name);
                            this.saltLine.result[currGroup] |= this.possessedPlayers.includes(this.players[i].name)
                            var saltIndex = (i - (pastDemon ? 1 : 0)).mod(this.players.length - 1);
                            if (saltIndex === this.saltLine.start || saltIndex === this.saltLine.end) {
                                currGroup = 1 - currGroup;
                            }
                        }
                        // If interference, flip results.
                        if (this.saltFlip[0]) this.saltLine.result[0] = !this.saltLine.result[0];
                        if (this.saltFlip[1]) this.saltLine.result[1] = !this.saltLine.result[1];
                        // No message, show visually.
                        this.message = "";
                        this.broadcastMessage(`Group: ${groups[0].map(p => `<c>${p}</c>`).join(", ")} ${this.saltLine.result[0] ? "DOES" : "DOES NOT"} contain a possessed player.`);
                        this.broadcastMessage(`Group: ${groups[1].map(p => `<c>${p}</c>`).join(", ")} ${this.saltLine.result[1] ? "DOES" : "DOES NOT"} contain a possessed player.`);
                        break;
                    }
                    case constants.items.SMUDGE: {
                        this.message = `${this.currentMove.targetName} has been warded against possession next round.`;
                        this.getPlayer(this.currentMove.targetId).isSmudged = true;
                        if (!(this.doInterfere || this.possessedPlayers.includes(this.currentMove.playerId))) {
                            this.smudgedPlayer = this.currentMove.targetId;
                            this.emit(this.demonId, "smudged player", this.currentMove.targetId);
                        }
                        break;
                    }
                }
                var wait = SHOW_RESULT_DISPLAY_SEC;
                var display = false;
                if (this.state === constants.states.INTERPRET) {
                    wait = this.settings.times[constants.times.INTERPRET];
                    display = true;
                }
                if (this.currentMove.type === constants.items.SALT) wait *= 2;
                this.autoAdvanceState(wait, display);
                break;
            }
            case constants.states.INTERPRET: {
                this.state = constants.states.DISPLAY;
                if (this.rodDisplay === undefined) {
                    this.message = `${this.currentMove.playerName} chooses not to share if ${this.currentMove.targetName} is possessed`;
                    this.broadcastMessage(`<c>${this.currentMove.playerName}</c> chooses not to share if <c>${this.currentMove.targetName}</c> is possessed`);
                } else {
                    let is = this.rodResult;
                    if (!this.rodDisplay) is = !is; 
                    this.message = `${this.currentMove.playerName} reports that ${this.currentMove.targetName} ${is ? "IS" : "IS NOT"} possessed`;
                    this.broadcastMessage(`<c>${this.currentMove.playerName}</c> reports that <c>${this.currentMove.targetName}</c> ${is ? "IS" : "IS NOT"} possessed`);
                }
                this.autoAdvanceState(SHOW_RESULT_DISPLAY_SEC);
                break;
            }
            case constants.states.DISPLAY: {
                this.handleTurnEnd();
                break;
            }
            case constants.states.END: {
                this.state = constants.states.LOBBY;
                this.clearMoves();
                this.msg = undefined;
                // Reset players.
                // TODO: make this states/conditions?
                this.players.forEach(p => {
                    p.isDemon = false;
                    p.wasDemon = false;
                    p.isDamned = false;
                    p.isExorcised = false;
                    p.isSmudged = false;
                    p.wasSmudged = false;
                    p.isPurified = false;
                    p.wasPurified = false;
                });
                break;
            }
        }
        this.updateTable();
    }

    handleTurnEnd() {
        this.doInterfere = false;
        this.saltFlip = [false, false];
        this.saltLine = {start: undefined, end: undefined};
        this.currentMove = undefined;
        this.clearVotes();

        if (this.settings.turnOrder) this.advanceCurrentPlayer();

        if (this.possessedPlayers.length === 0) {
            // Good guys win!
            this.state = constants.states.END;
            this.message = PLAYER_WIN_MESSAGE;
            let winners = [];
            for (var tablePlayer of this.players) {
                if (tablePlayer.isDemon || this.damnedPlayers.includes(tablePlayer.id)) {
                    tablePlayer.isDamned = true;
                } else {
                    winners.push(tablePlayer.name);
                }
                if (tablePlayer.isDemon) {
                    tablePlayer.wasDemon = true;
                    tablePlayer.isDemon = false;
                }
            }
            this.broadcastMessage(`The virtuous win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
            this.handleGameEnd();
        } else if (this.isStillDay()) {
            this.state = constants.states.DAY;
            if (this.settings.turnOrder) {
                this.message = `It is ${this.getCurrentPlayer().name}'s turn to select a tool`;
                this.broadcastMessage(`It is <c>${this.getCurrentPlayer().name}</c>'s turn to select a tool`);
                this.autoAdvanceState(this.settings.times[constants.times.TURN], true);
            } else {
                this.message = DAY_PLAYER_MSG;
                this.demonMessage = DAY_DEMON_MSG;
            }
        } else if (this.possessedPlayers.length >= (this.players.length - 1) / 2) {
            // Bad guys win
            this.state = constants.states.END;
            this.message = DEMON_WIN_MESSAGE;
            let winners = [];
            for (var tablePlayer of this.players) {
                if (tablePlayer.isDemon || this.possessedPlayers.includes(tablePlayer.id)) {
                    tablePlayer.isDamned = true;
                    winners.push(tablePlayer.name);
                }
                if (tablePlayer.isDemon) {
                    tablePlayer.wasDemon = true;
                    tablePlayer.isDemon = false;
                }
            }
            this.broadcastMessage(`The damned win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
            this.handleGameEnd();
        } else {
            this.handleNewRound();
        }
    }

    isStillDay() {
        if (this.settings.turnOrder) {
            if (this.currentPlayer === this.startPlayer) return false;
        } else {
            if (this.gameTimedOut) return false;
        }

        // Check if any player can make a move.
        if (!this.itemsInUse.reduce((sum, item) => sum += this.resources[item], 0)) return false;

        // If any player can still make a move, go back to day, otherwise go to night.
        if (this.players.find(p => p.move === undefined && !p.isDemon && !p.isExorcised)) return true;

        return false;
    }

    handleGameEnd() {
        this.demonId = undefined;
        this.clearMoves();
        this.clearTimer(constants.timers.MOVE);
        this.clearTimer(constants.timers.ROUND);
    }

    handleNewGame() {
        this.clearMoves();
        this.clearVotes();

        // Game holds secret information.
        this.interfereUses = {
            [constants.items.WATER]: 0,
            [constants.items.BOARD]: 1,
            [constants.items.ROD]: 1,
            [constants.items.EXORCISM]: 1,
            [constants.items.SALT]: 1,
            [constants.items.SMUDGE]: 1,
        };
        this.possessedPlayers = [];
        this.timers = {};

        // Clear chat logs
        this.clearChats();

        // Select demon candidate
        this.selectDemonCandidate(true);

        // Reset resources
        this.resources = {
            [constants.items.WATER]: -1,
        };
        this.round = 0;
        this.saltLine = {start: undefined, end: undefined};

        // Reset timers
        this.timers = {
            [constants.timers.ROUND]: false,
            [constants.timers.MOVE]: false,
        };

        // Set turn order
        this.startPlayer = undefined;
    }

    selectDemonCandidate(start=false) {
        if (start) {
            this.demonCandidates = [];
            this.demonCandidate = undefined;
        }
        if (this.demonCandidate) utils.removeByValue(this.demonCandidates, this.demonCandidate);
        if (this.demonCandidates.length === 0) this.demonCandidates = this.players.map(p => p.id);
        let index = Math.floor(Math.random() * this.demonCandidates.length);
        this.demonCandidate = this.demonCandidates[index];
        this.emit(this.demonCandidate, "accept demon");
    }

    handleNewRound() {
        this.round += 1;
        this.state = constants.states.NIGHT;
        this.demonMessage = NIGHT_DEMON_MSG;
        this.clearTimer(constants.timers.ROUND);

        this.clearMoves();
        this.clearVotes();
        
        if (this.round > 1) {
            this.message = `Night falls... there ${this.anyInterfere ? "WAS" : "WAS NOT"} interference during the round.`;
            this.broadcastMessage(`There <b>${this.anyInterfere ? "WAS" : "WAS NOT"}</b> interference during the round.`);
        } else {
            this.message = NIGHT_PLAYER_MSG;
        }

        this.damnedPlayers = [];
        this.anyInterfere = false;
        this.gameTimedOut = false;

        // Clear lasting states
        this.players.forEach(player => {
            player.isExorcised = false;
            player.wasSmudged = player.isSmudged;
            player.wasPurified = player.isPurified;
        });

        if (this.settings.turnOrder) {
            this.advanceStartPlayer();
            this.currentPlayer = this.startPlayer;
        }

        // Update resources
        this.resources = {
            [constants.items.BOARD]: 1,
            [constants.items.WATER]: Math.floor(Math.min(this.players.length / 3, this.resources[constants.items.WATER] + 1)),
            [constants.items.ROD]: 1,
            [constants.items.EXORCISM]: 1,
            [constants.items.SALT]: 1,
            [constants.items.SMUDGE]: 1,
        };
    }

    possessPlayer(id, doPossess) {
        if (doPossess) {
            if (this.possessedPlayers.includes(id)) return false;
            this.possessedPlayers.push(id);
            this.demonChats[id] = [];
            this.sendDemonMessage("You have been possessed!", id);
        } else {
            if (!this.possessedPlayers.includes(id)) return false;
            utils.removeByValue(this.possessedPlayers, id);
            this.damnedPlayers.push(id);
        }
        this.emit(this.demonId, "possessed players", this.possessedPlayers);
        this.emit(id, "possession", doPossess);
        return true;
    }

    clearMoves() {
        this.players.forEach(p => p.move = undefined);
        this.currentMove = undefined;
    }

    clearVotes() {
        this.players.forEach(player => {
            player.voted = false;
            player.vote = undefined;
        });
        this.votes = {};
    }

    tallyVotes(makePublic) {
        const tally = {
            true: [],
            false: [],
            undefined: [],
        }
        this.players.forEach(p => {
            if (p.isDemon || p.isExorcised) return;
            tally[this.votes[p.name]].push(p.name);
            if (makePublic) p.vote = this.votes[p.name];
        });
        return tally;
    }

    clearTimer(timer) {
        if (this.timerInfo[timer]) clearTimeout(this.timerInfo[timer].id);
        this.timerInfo[timer] = undefined;
        this.timers[timer] = false;
    }

    autoAdvanceState(delay, display=false) {
        this.timerInfo[constants.timers.MOVE] = setTimer(this.advanceState.bind(this), delay, display);
        if (display) this.timers[constants.timers.MOVE] = getTimerValue(delay);
    }
    
    autoAdvanceRound(delay) {
        if (!delay) delay = this.settings.times[constants.times.ROUND];
        this.timerInfo[constants.timers.ROUND] = setTimer(this.timeoutRound.bind(this), delay, true);
        this.timers[constants.timers.ROUND] = getTimerValue(delay);
    }
    
    timeoutRound() {
        this.roundTimedOut = true;
        if (this.state === constants.states.DAY) {
            this.message = "The sun is settings, night is falling...";
            this.state = constants.states.DISPLAY;
            this.autoAdvanceState(constants.ROUND_OVER_DISPLAY_SEC);
            this.updateTable();
        }
    }

    ////////// Helpers \\\\\\\\\\

    isDemon(id) {
        return id === this.demonId;
    }

    getPlayer(id) {
        return this.players.find(p => p.id === id);
    }

    isOwner(id) {
        return this.players.length > 0 && this.players[0].id === id;
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }

    advanceCurrentPlayer() {
        this.currentPlayer = this.nextPlayer(this.currentPlayer);
    }

    advanceStartPlayer() {
        if (this.startPlayer === undefined) this.startPlayer = Math.floor(Math.random() * this.players.length);
        this.startPlayer = this.nextPlayer(this.startPlayer);
    }

    nextPlayer(index) {
        do {
            index = (index + 1).mod(this.players.length);
        } while(this.players[index].id === this.demonId || this.players[index].isExorcised);
        return index;
    }

    getAvailableColor(perference) {
        const tableColors = this.players.map(p => p.color);
        if (perference && !tableColors.includes(perference)) return perference;
        return constants.PLAYER_COLORS.find(c => !tableColors.includes(c));
    }
}

function setTimer(callback, sec, display) {
    return {
        id: Number(setTimeout(callback, sec * 1000)),
        start: Date.now(),
        duration: sec,
        display: display,
    }
}

function getTimerValue(sec) {
	return Date.now() + sec * 1000;
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

module.exports = Room;