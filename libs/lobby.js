var ENV = process.env.NODE_ENV || "development";
var DEBUG = ENV === "development";

const { v4 } = require("uuid");

const Room = require("./room");

class MemoryStore {
    constructor() {
        this.sessionToId = {};
        this.players = {};
    }

    getPlayer(fields) {
        const id = fields.id ? fields.id : this.sessionToId[fields.sessionId];
        if (id) return this.players[id];
    }

    addPlayer(sessionId) {
        let id = v4();
        this.sessionToId[sessionId] = id;
        this.players[id] = {
            gameCode: undefined,
            active: true,
        };
        return id; 
    }

    updatePlayer(player) {
        Object.assign(this.players[player.id], player);
    }

    deletePlayer(id) {
        delete this.players[id];
    }

    // Do nothing for memory store, as we cannot persist.
    storeRoomState() {}
    // Only used for initial restore, not needed.
    rooms() { return [] }
    deleteRoom() {}
}

class DbStore {
    constructor(db) {
        this.db = db;
        this.isActive = {};

        this.userTable = "users";
        this.roomTable = "rooms";
    }

    async getPlayer(fields) {
        console.log("$$$ FIELDS $$$");
        for (var k in fields) {
            console.log(`${k} ${fields[k]}`);
        }
        let player = await this.db(this.userTable).where(fields).first();
        try {
            player.active = this.isActive[player.id] || false;
            return player;
        } catch(error) {
            return undefined;
        }
    }

    async addPlayer(sessionId) {
        const res = await this.db(this.userTable).insert({sessionId: sessionId}).returning("id");
        try {
            let id = res[0];
            this.isActive[id] = true;
            return id;
        } catch(error) {
            return undefined;
        }
    }

    async updatePlayer(player) {
        if (player.active !== undefined) this.isActive[player.id] = player.active;
        delete player.active;
        await this.db(this.userTable).insert(player).onConflict("id").merge();
    }

    async deletePlayer(id) {
        delete this.isActive[id];
        this.db(this.userTable).where({id: id}).del();
    }

    async storeRoomState(code, state) {
        await this.db(this.roomTable).insert({code: code, state: JSON.stringify(state)}).onConflict("code").merge();
    }

    async rooms() {
        return await this.db(this.roomTable);
    }

    async deleteRoom(code) {
        this.db(this.roomsTable).where({code: code}).del();
    }
}

class Lobby {
    constructor(io, db) {
        this.io = io;
        this.socketToId = {};

        this.store = db ? new DbStore(db) : new MemoryStore();
        this.rooms = {};

        this.INACTIVE_TABLE_DELETION_SEC = DEBUG ? 1 : 1 * 60 * 60;
    }

    async restore() {
        if (DEBUG && this.store.db) {
            await this.store.db("rooms").truncate();
        }
        let dbRooms = await this.store.rooms();
        dbRooms.forEach(room => {
            this.createRoom(undefined, room.code);
            this.rooms[room.code].restore(room.state);
        });
    }

    storeRoom(code, state) {
        this.store.storeRoomState(code, state);
    }
    
    listen() {
        this.io.on("connection", function(socket) {
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
    
    makeCode() {
        const charset = DEBUG ? String.fromCharCode('A'.charCodeAt() + Object.keys(this.rooms).length) : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        const codeLen = 4;
        let code = "";
        for (var i = 0; i < codeLen; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return code;
    }

    getUnusedCode() {
        do { var code = this.makeCode(); } while (code in this.rooms);
        return code;
    }

    createRoom(settings, code) {
        code = code ? code : this.getUnusedCode();
        this.rooms[code] = new Room(
            this.io,
            code,
            settings,
            this.storeRoom.bind(this, code),
            this.deleteRoom.bind(this, code),
        );
        return code;
    }

    async addPlayer(socket) {
        const sessionId = DEBUG ? `${socket.id} session` : socket.handshake.session.id;
        if (DEBUG) socket.emit("init settings", { DEBUG: DEBUG });
        let player = await this.store.getPlayer({sessionId: sessionId});
        console.log(`SESSION: ${sessionId} - ID: ${player ? player.id : "new"} - SOCKET: ${socket.id}`);
        if (player) {
            // Got an existing session
            if (player.active) {
                socket.emit("server error", "Found existing session in another tab");
            } else {
                this.socketToId[socket.id] = player.id;
                player.active = true;

                // If room exists, restore player
                const room = this.rooms[player.roomCode];
                if (room) {
                    if (!room.addPlayer(socket, player.id)) {
                        socket.emit("server error", `Unable to rejoin ${player.roomCode}!`);
                        // Player was not successfully added back to room, reset.
                        player.roomCode = undefined;
                    }
                }
            }
            this.store.updatePlayer(player);
        } else {
            // New session
            const id = await this.store.addPlayer(sessionId);
            this.socketToId[socket.id] = id;
        }
    }

    addPlayerToRoom(socket, code, settings) {
        const id = this.socketToId[socket.id];
        if (!id) return;
        const room = this.rooms[code];
        if (room) {
            if (room.addPlayer(socket, id, settings)) this.store.updatePlayer({id: id, roomCode: code});
        } else {
            socket.emit("server error", `Table ${code} not found!`);
        }
    }

    removePlayerFromRoom(socket) {
        const { id, room } = this.getContext(socket);
        if (room && room.removePlayer(socket, id) && room.empty()) this.deleteRoom(room.code);
    }

    async removePlayer(socket) {
    	// TODO: set timer to delete inactive player
        const { id, player, room } = await this.getContext(socket);
        if (room) {
            if (room.removePlayer(socket, id)) player.roomCode = undefined;
            else if (!room.active()) this.scheduleRoomDeletion(room.code);
        }
        delete this.socketToId[socket.id];
        if (player) {
            player.active = false;
            this.store.updatePlayer(player);
        }
    }

    async getContext(socket) {
        const id = this.socketToId[socket.id];
        if (!id) console.log(`FOUND NO PLAYER ID FOR SOCKET: ${socket.id}`);
        const player = id ? await this.store.getPlayer({id: id}) : undefined;
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
        this.store.deleteRoom(code);
    }
}

module.exports = Lobby;