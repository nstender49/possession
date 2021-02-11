var cookie = require("cookie");
const e = require("express");  // TODO: needed?
const { v4 } = require("uuid");

const Room = require("./room");

class Lobby {
    constructor(io, debug) {
        this.io = io;
        this.rooms = {};
        this.players = {};
        this.socketToId = {};
        this.sessionToId = {};

        this.debug = debug;
        this.INACTIVE_TABLE_DELETION_SEC = this.debug ? 1 : 1 * 60 * 60;
    }

    // Table / game
    
    makeCode() {
        const charset = this.debug ? String.fromCharCode('A'.charCodeAt() + Object.keys(this.rooms).length) : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        const codeLen = 4;
        let code = "";
        for (var i = 0; i < codeLen; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return code;
    }
    
    getNewCode() {
        do {
            var code = this.makeCode();
        } while (code in this.rooms);
        return code;
    }

    createRoom(settings) {
        const code = this.getNewCode();
        this.rooms[code] = new Room(this.io, code, settings);
        return code;
    }

    addPlayer(socket) {
        const sessionId = this.debug ? `${socket.id} session` : cookie.parse(socket.request.headers.cookie)["connect.sid"];
    
        let id = this.sessionToId[sessionId];
        console.log(`SESSION: ${sessionId}  - ID: ${id}`);
        if (id) {
            // Got and existing session
            const player = this.players[id];
            if (player.active) {
                socket.emit("server error", "Found existing session in another tab");
            } else {
                socket.emit("player id", id);
                this.socketToId[socket.id] = id;
                this.sessionToId[sessionId] = id;
                player.active = true;

                // If room exists, restore player
                const room = this.rooms[player.roomCode];
                if (room) {
                    if (!room.markPlayerActive(socket, id)) {
                        socket.emit("clear state");
                        socket.emit("server error", `Unable to rejoin ${player.roomCode}!`);
                        // Player was not successfully added back to room, reset.
                        player.roomCode = undefined;
                    }
                } else {
                    socket.emit("clear state");
                }
            }
        } else {
            // New session
            id = v4();
            this.players[id] = {
                gameCode: undefined,
                active: true,
            };
            socket.emit("player id", id);
            socket.emit("clear state");
            this.socketToId[socket.id] = id;
            this.sessionToId[sessionId] = id;
        }
    }

    updatePlayer(socket, settings) {
        const { id, room } = this.getContext(socket);
        if (room) room.updatePlayer(id, settings);
    }

    updateSettings(socket, settings) {
        const { id, room } = this.getContext(socket);
        if (room) room.updateSettings(id, settings);
    }

    addPlayerToRoom(socket, code, settings) {
        const id = this.socketToId[socket.id];
        if (!id) return;
        const room = this.rooms[code];
        if (room) {
            if (room.addPlayer(socket, id, settings)) this.players[id].roomCode = code;
        } else {
            socket.emit("server error", `Table ${code} not found!`);
        }
    }

    removePlayerFromRoom(socket) {
        const { id, room } = this.getContext(socket);
        if (room) {
            room.removePlayer(socket, id);
            if (room.empty()) this.deleteRoom(room.code);
        }
    }

    markPlayerInactive(socket) {    	
    	// TODO: set timer to delete inactive player
        // TODO: remove from table if in lobby.
        const { id, player, room } = this.getContext(socket);
        delete this.socketToId[socket.id];
        if (player) player.active = false;
        if (room) {
            room.markPlayerInactive(id);
            if (!room.active()) this.scheduleRoomDeletion(room.code);
        }
    }

    handleMove(socket, move) {
        const { id, room } = this.getContext(socket);
        if (room) room.handleMove(id, move);
    }

    sendMessage(socket, msg, targetName) {
        const { id, room } = this.getContext(socket);
        if (room) room.sendMessage(id, msg, targetName);
    }
    
    getContext(socket) {
        const id = this.socketToId[socket.id];
        const player = this.players[id];
        const room = player && player.roomCode ? this.rooms[player.roomCode] : undefined;
        return {
            id: id,
            player: player,
            room: room,
        };
    }

    deleteIfInactive(code) {
        const room = this.rooms[code];
        if (room && !room.active()) this.deleteRoom(code);
    }

    scheduleRoomDeletion(code) {
        setTimeout(this.deleteIfInactive.bind(this, code), this.INACTIVE_TABLE_DELETION_SEC * 1000);
    }

    deleteRoom(code) {
        delete this.rooms[code];
    }
}

module.exports = Lobby;