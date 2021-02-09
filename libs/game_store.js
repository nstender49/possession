const GENERAL = "GENERAL";

class GameStore {
    constructor(debug) {
        this.players = {};
        this.socketMap = {};

        this.tables = {};
        this.games = {};

        this.chatLogs = {};

        this.debug = debug;
        this.INACTIVE_TABLE_DELETION_SEC = this.debug ? 1 : 1 * 60 * 60;
    }

    // Table / game
    
    makeTableCode() {
        const charset = this.debug ? String.fromCharCode('A'.charCodeAt() + Object.keys(this.tables).length) : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        const codeLen = 4;
        let code = "";
        for (var i = 0; i < codeLen; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return code;
    }
    
    getNewCode() {
        do {
            var code = this.makeTableCode();
        } while (code in this.tables);
        return code;
    }

    createTable(table) {
        table.code = this.getNewCode();
        this.tables[table.code] = table;
        this.clearChat(table.code);
        this.games[table.code] = {};
        return table;
    }

    setGame(code, game) {
        this.games[code] = game;
    }

    // Player

    createPlayer(socket, sessionId) {
        this.players[sessionId] = {
            socket: socket,
            sessionId: sessionId,
            tableCode: undefined,
        }
        this.socketMap[socket.id] = sessionId;
    }

    markPlayerActive(socket, sessionId) {
        if (!(sessionId in this.players)) return;
        this.players[sessionId].socket = socket;
        this.players[sessionId].active = true;
        this.socketMap[socket.id] = sessionId;
    }

    markPlayerInactive(socket) {    	
    	// TODO: set timer to delete inactive playr
        const id = this.getPlayerId(socket.id);
        if (!id) return;
        delete this.socketMap[socket.id];
        const player = this.getPlayer(id);
        if (!player) return;
        player.socket = undefined;
        player.active = false;
        return player;
    }

    // Chat

    clearChat(code, channel) {
        if (channel) this.chatLogs[code][channel] = [];
        else this.chatLogs[code] = {[GENERAL]: []};
    }

    getChatLogs(code, channel) {
        if (channel) return this.chatLogs[code][channel];
        else return this.chatLogs[code];
    }

    addChatMsg(code, channel, msg) {
        if (!(code in this.chatLogs)) return;
        if (!(channel in this.chatLogs[code])) this.chatLogs[code][channel] = [];
        this.chatLogs[code][channel].push(msg);
    }

    // Getters / setters
    
    getContext(socket) {
        const id = this.getPlayerId(socket.id);
        const player = this.getPlayer(id);
        const table = player.tableCode ? this.getTable(player.tableCode) : undefined;
        const tablePlayer = table ? table.players.find(p => p.sessionId === player.sessionId) : undefined;
        return {
            id: id,
            player: player,
            table: table,
            tablePlayer: tablePlayer,
        };
    }

    getSocketTable(socketId) {
        var player = this.getSocketPlayer(socketId);
        return player ? this.getTable(player.tableCode) : undefined;
    }
    
    getSocketPlayer(socketId) {
        return this.getPlayer(this.socketMap[socketId]);
    }

    getPlayerId(socketId) {
        return this.socketMap[socketId];
    }

    getPlayer(id) {
        return this.players[id];
    }
    
    getTable(code) {
        return code ? this.tables[code.toUpperCase()] : undefined;
    }

    getGame(code) {
        return code ? this.games[code.toUpperCase()] : undefined;
    }

    deleteGame(code) {
        delete this.games[code];
    }

    deleteIfInactive(code) {
        let table = this.tables[code];
        if (!table) return;
        if (table.players.reduce((acc, p) => acc || p.active, false)) return;
        this.deleteTable(code);
    }

    scheduleTableDeletion(code) {
        setTimeout(this.deleteIfInactive.bind(this, code), this.INACTIVE_TABLE_DELETION_SEC * 1000);
    }

    deleteChat(code) {
        delete this.chatLogs[code];
    }

    deleteTable(code) {
        this.deleteGame(code);
        this.deleteChat(code);
        delete this.tables[code];
    }
}

module.exports = GameStore;