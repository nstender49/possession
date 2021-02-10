var cookie = require("cookie");
const e = require("express");

const Room = require("./room");

class Lobby {
    constructor(io, debug) {
        this.io = io;
        this.rooms = {};
        this.players = {};
        this.socketToId = {};

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
        socket.emit("player id", sessionId);

        const player = this.players[sessionId];
        this.socketToId[socket.id] = sessionId;
        if (!player) {
            this.players[sessionId] = {
                socket: socket,
                sessionId: sessionId,
                roomCode: undefined,
            }
            return;
        }

        if (player.active) {
            socket.emit("server error", "Found existing session in another tab");
		    return;
        }

        player.socket = socket;
        player.active = true;

        const room = this.rooms[player.roomCode];
        if (room) room.markPlayerActive(socket, sessionId);
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
        if (!room) {
            socket.emit("server error", `Table ${code} not found!`);
            return;
        }
        let success = room.addPlayer(socket, id, settings);
        if (success) this.players[id].roomCode = code;
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
        if (player) {
            player.socket = undefined;
            player.active = false;
        }
        if (room) {
            room.markPlayerInactive(id);
            if (!room.active()) this.scheduleRoomDeletion(room.code);
        }
    }

    handleMove(socket, move) {
        const { id, room } = this.getContext(socket);
        if (!room) return;
        room.handleMove(id, move);
    }
    
    getContext(socket) {
        const id = this.socketToId[socket.id];
        const player = this.players[id];
        const room = player.roomCode ? this.rooms[player.roomCode] : undefined;
        return {
            id: id,
            player: player,
            room: room,
        };
    }

    deleteIfInactive(code) {
        const room = this.rooms[code];
        if (!room) return;
        if (!room.active()) this.deleteRoom(code);
    }

    scheduleRoomDeletion(code) {
        setTimeout(this.deleteIfInactive.bind(this, code), this.INACTIVE_TABLE_DELETION_SEC * 1000);
    }

    deleteRoom(code) {
        delete this.rooms[code];
    }
}

module.exports = Lobby;