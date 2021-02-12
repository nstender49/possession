var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var cookie = require("cookie");
const { v4 } = require("uuid");

const Room = require("./room");

class Lobby {
    constructor(io) {
        this.io = io;

        this.rooms = {};
        this.players = {};
        this.socketToId = {};
        this.sessionToId = {};

        this.INACTIVE_TABLE_DELETION_SEC = DEBUG ? 1 : 1 * 60 * 60;
    }
    
    listen() {
        this.io.on("connection", function(socket) {
            if (!socket.request.headers.cookie) {
                socket.emit("server error", "No cookie!");
                return false;
            }
    
            this.addPlayer(socket);
    
            socket.on("disconnect", function() {
                this.removePlayer(socket);
            }.bind(this));
    
            socket.on("make table", function(tableSettings, playerSettings) {
                if (!Room.validatePlayer(socket, playerSettings)) return;
                const code = this.createRoom(tableSettings);
                this.addPlayerToRoom(socket, code, playerSettings);
            }.bind(this));
    
            socket.on("join table", function(code, playerSettings) {
                if (!Room.validatePlayer(socket, playerSettings)) return;
                this.addPlayerToRoom(socket, code, playerSettings);
            }.bind(this));
        }.bind(this));
    }
    
    getUnusedCode() {
        do { var code = Room.makeCode(); } while (code in this.rooms);
        return code;
    }

    createRoom(settings) {
        const code = this.getUnusedCode();
        this.rooms[code] = new Room(this.io, code, settings);
        return code;
    }

    addPlayer(socket) {
        const sessionId = DEBUG ? `${socket.id} session` : cookie.parse(socket.request.headers.cookie)["connect.sid"];
        if (DEBUG) socket.emit("init settings", { DEBUG: DEBUG });

        let id = this.sessionToId[sessionId];
        console.log(`SESSION: ${sessionId} - ID: ${id}`);
        if (id) {
            // Got an existing session
            const player = this.players[id];
            if (player.active) {
                socket.emit("server error", "Found existing session in another tab");
            } else {
                this.socketToId[socket.id] = id;
                this.sessionToId[sessionId] = id;
                player.active = true;

                // If room exists, restore player
                const room = this.rooms[player.roomCode];
                if (room) {
                    if (!room.addPlayer(socket, id)) {
                        socket.emit("server error", `Unable to rejoin ${player.roomCode}!`);
                        // Player was not successfully added back to room, reset.
                        player.roomCode = undefined;
                    }
                }
            }
        } else {
            // New session
            id = v4();
            this.players[id] = {
                gameCode: undefined,
                active: true,
            };
            this.socketToId[socket.id] = id;
            this.sessionToId[sessionId] = id;
        }
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
        if (room && room.removePlayer(socket, id) && room.empty()) this.deleteRoom(room.code);
    }

    removePlayer(socket) {    	
    	// TODO: set timer to delete inactive player
        const { id, player, room } = this.getContext(socket);
        if (room) {
            if (room.removePlayer(socket, id)) player.roomCode = undefined;
            else if (!room.active()) this.scheduleRoomDeletion(room.code);
        }
        delete this.socketToId[socket.id];
        player.active = false;
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