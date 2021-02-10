// This file handles all socket.io connections and manages the serverside game logic.
var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var socketio = require("socket.io");
const e = require("express");
const Lobby = require("./lobby");

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);
	lobby = new Lobby(io, DEBUG);

	io.on("connection", function(socket) {
		if (!socket.request.headers.cookie) {
			socket.emit("server error", "No cookie!");
			return false;
		}

		socket.emit("init settings", {
			DEBUG: DEBUG,
			code_version: process.env.npm_package_version,
		});

		lobby.addPlayer(socket);

		socket.on("disconnect", function() {
			lobby.markPlayerInactive(socket);
		});

		socket.on("make table", function(tableSettings, playerSettings) {
			if (!checkName(socket, playerSettings.name)) return;
			const code = lobby.createRoom(tableSettings);
			lobby.addPlayerToRoom(socket, code, playerSettings);
		});

		socket.on("join table", function(code, playerSettings) {
			if (!checkName(socket, playerSettings.name)) return;
			lobby.addPlayerToRoom(socket, code, playerSettings);
		});

		socket.on("leave table", function() {
			lobby.removePlayerFromRoom(socket);
		});

		socket.on("do move", function(move) {
			lobby.handleMove(socket, move);
		});

		socket.on("chat msg", function(msg, targetName) {
			lobby.sendMessage(socket, msg, targetName);
		});

		socket.on("update settings", function(settings) {
			lobby.updateSettings(socket, settings);
		});

		socket.on("update player settings", function(settings) {
			lobby.updatePlayer(socket, settings);
		});
	});
	return io;
};

function checkName(socket, name) {
	if (name.match("^[\\d\\w\\s!]+$")) return true;
	socket.emit("server error", `Invalid name: '${name}', alphanumeric only!`);
	return false;
}