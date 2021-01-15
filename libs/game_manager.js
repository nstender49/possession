// This file handles all socket.io connections and manages the serverside game logic.
var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var socketio = require("socket.io");
var cookie = require("cookie");

var players = [];
var inactive = [];
var tables = [];
var chatLogs = [];
const GENERAL = "general";
var games = [];

// Delete tables with all inactive players after 1 hour
const INACTIVE_TABLE_DELETION_SEC = DEBUG ? 1 : 1 * 60 * 60;
const FAILED_SECOND_DISPLAY_SEC = 1;
const FAILED_VOTE_DISPLAY_SEC = 5;
const ROUND_OVER_DISPLAY_SEC = 3;
const SHOW_RESULT_DISPLAY_SEC = 5;
const INTERFERE_WAIT_SEC = 5;

const WAIT_MSG = "Waiting for players to join...";
const BEGIN_MSG = "Waiting for owner to start game...";
const NIGHT_PLAYER_MSG = "Night falls, the demon is possessing a victim...";
const NIGHT_DEMON_MSG = "Select a victim to possess >:)";
const DAY_PLAYER_MSG = "Use these tools to purge the evil from your midst...";
const DAY_DEMON_MSG = "Whisper in your minons' ears >:D";

const ITEM_PROPOSE_MSG = {
	BOARD: "consult the spirit board",
	WATER: "use holy water",
	ROD: "use the divining rod",
	EXORCISM: "perform an exorcism",
};
const ITEM_USE_MSG = {
	BOARD: "consulting with the spirits about",
	WATER: "using holy water on",
	ROD: "testing the purity of",
	EXORCISM: "performing an exorcism on",
};

const PLAYER_COLORS = ["red", "orange", "yellow", "green", "blue", "lime", "purple", "white", "brown", "cyan", "pink", "grey"];

// Game states
const INIT = "init";
const MAIN_MENU = "main menu";
const TABLE_LOBBY = "table lobby";
const TABLE_NIGHT = "table night";
const TABLE_DAY = "table day";
const TABLE_SECONDING = "table seconding";
const TABLE_VOTING = "table voting"; 
const TABLE_SELECT = "table selecting player";
const TABLE_INTERFERE = "table demon interference"
const TABLE_DISPLAY = "table display result";

// Moves players can make
const BEGIN = "BEGIN";
const SECOND = "SECOND";
const VOTE = "VOTE";
const PASS = "PASS";
const BOARD = "BOARD";
const WATER = "WATER";
const ROD = "ROD";
const EXORCISM = "EXORCISM";
const SELECT = "SELECT";
const INTERFERE = "INTERFERE";

var logFull = true;

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);

	io.on("connection", function(socket) {
		if (!socket.request.headers.cookie) {
			socket.emit("server error", "No cookie!");
			return false;
		}
		console.log(process.env.npm_package_version);
		socket.emit("init settings", {
			DEBUG: DEBUG,
			code_version: process.env.npm_package_version,
		});

		handleNewConnection(socket);

		socket.on("disconnect", function() {
			playerDisconnected(socket);
		});

		socket.on("make table", function(name, settings) {
			var code = createTable(settings);
			joinTable(socket, code, name);
		});

		socket.on("join table", function(code, name) {
			joinTable(socket, code, name);
		});

		socket.on("leave table", function() {
			leaveTable(socket);
		});

		socket.on("do move", function(move) {
			processMove(socket, move);
		});

		socket.on("update settings", function(settings) {
			updateSettings(socket, settings);
		});

		socket.on("chat msg", function(msg, targetName) {
			sendMessage(socket, msg, targetName);
		});
	});
	return io;
};

//////////  Functions  \\\\\\\\\\
 
///// Lobby \\\\\

function createTable(settings) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = {
		// Session
		code: createTableCode(),
		players: [],
		settings: settings,
		// Game
		state: TABLE_LOBBY,
		message: WAIT_MSG,
		demonMessage: undefined,
		resources: [],
		demonId: undefined,
		currentMove: undefined,
	};
	chatLogs[table.code] = [];
	chatLogs[table.code][GENERAL] = [];
	tables.push(table);
	return table.code;
}

function updateSettings(socket, settings) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = getTableBySocketId(socket.id);
	if (!table) { return false; }
	if (isTableOwner(socket.id, table)) {
		table.settings = settings;
		updateTable(table);
	} else {
		socket.emit("server error", "Only owner can modify table settings!");
	}
}

function joinTable(socket, code, name) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);

	// Check for errors
	if (!player) {
		player.socket.emit("server error", "Invalid connection to server!");
		return false;
	}
	var table = getTableByCode(code);
	if (!table) {
		player.socket.emit("server error", "Table " + code + " not found!");
		return false;
	}
	if (table.players.length >= table.settings.maxPlayers) {
		player.socket.emit("server error", "Table " + code + " full!");
		return false;
	}
	if (table.state !== TABLE_LOBBY) {
		player.socket.emit("server error", "Table " + code + " game in progress!");
		return false;
	}
	for (var tablePlayer of table.players) {
		if (name === tablePlayer.name) {
			player.socket.emit("server error", "Player with name '" + name + "' already exists at table " + code);
			return false;
		}
	}
	// Add player to the table.
	player.tableCode = code;
	console.log(`ADDING PLAYER WITH SESSIONID ${player.sessionId} AND SOCKETID ${player.socket.id}`)
	table.players.push({
		// Session
		sessionId: player.sessionId,
		socketId: player.socket.id,
		active: true,
		// Settings
		name: name,
		avatarId: table.players.length,
		color: getAvailableColor(table),
		// Game
		isDemon: false,
		move: undefined,
		voted: false,
	});
	if (table.state === TABLE_LOBBY && table.players.length >= table.settings.minPlayers) {
		table.message = BEGIN_MSG;
	}
	// Update player on the current state of the world.
	updateTable(table);
	for (var l of chatLogs[table.code][GENERAL]) {
		socket.emit("chat msg", l.msg, l.sender);
	}
	// TODO: this is for recovering player, belong with inactive player stuff...
	if (chatLogs[table.code][name]) {
		for (var l of chatLogs[table.code][name]) {
			socket.emit("demon msg", l.msg, l.player);
		}
	}
	var game = getGameByCode(table.code);
	if (game) {
		if (game.possessedPlayers.includes(name)) {
			targetPlayer.socket.emit("possession", doPossess);
		}
	}
}

function leaveTable(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = getTableBySocketId(socket.id);
	if (!table) { return false; }

	if (table.state !== TABLE_LOBBY) {
		player.socket.emit("server error", "Cannot leave table while a game is in progress!");
		return false;
	}
	// Remove player.
	for (var i = 0; i < table.players.length; i++) {
		if (table.players[i].socketId === socket.id) {
			table.players.splice(i, 1);
			break;
		}
	}
	if (table.players.length === 0) {
		deleteTable(table);
		table = false;
	} else {
		table.message = table.players.length < table.settings.minPlayers ? WAIT_MSG : BEGIN_MSG;
		// Update remaining players.
		updateTable(table);
	}
	bouncePlayer(socket);
}

function deleteTable(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Delete game and table.
	var game = getGameByCode(table.code);
	if (game) {
		var index = games.indexOf(game);
		games.splice(index, 1);
	}
	if (chatLogs[table.code]) {
		delete chatLogs[table.code];
	}
	var index = tables.indexOf(table);
	tables.splice(index, 1);
}

///// client/server \\\\\

function sendMessage(socket, msg, targetName) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);

	if (tablePlayer.isDemon) {
		if (!targetName) return;
		sendDemonMessage(table, msg, targetName, tablePlayer.name);
	} else {
		broadcastMessage(table, msg, tablePlayer.name);
	}
}

function processMove(socket, move) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);

	if (tablePlayer.isDemon) {
		var result = processDemonMove(table, player, move);
	} else {
		var result = processPlayerMove(table, player, tablePlayer, move);
	}
	
	if (result.advance) {
		var error = advanceRound(table);
		if (error) {
			socket.emit("server error", error);
		}
	} else if (result.handled) {
		updateTable(table);
	} else {
		console.error(`Move not handled! State: ${table.state}, move: ${move}`);
	}
}

function possessPlayer(table, targetId, doPossess) {
	var game = getGameByCode(table.code);
	var demonPlayer = getPlayerBySessionId(table.demonId);
	var demonTablePlayer = getTablePlayerBySessionId(table.demonId, table);
	var tablePlayer = getTablePlayerBySessionId(targetId, table);
	var targetPlayer = getPlayerBySessionId(targetId);
	if (doPossess) {
		if (game.possessedPlayers.includes(tablePlayer.name)) {
			return false;
		}
		chatLogs[table.code][tablePlayer.name] = [];
		sendDemonMessage(table, "You have been possessed!", tablePlayer.name);
		game.possessedPlayers.push(tablePlayer.name);
	} else {
		if (!game.possessedPlayers.includes(tablePlayer.name)) {
			return false;
		}
		var index = game.possessedPlayers.indexOf(tablePlayer.name);
		if (index > -1) {
			game.possessedPlayers.splice(index, 1);
		}
		targetPlayer.socket.emit("clear chat", "demon-chat");
		chatLogs[table.code][tablePlayer.name] = [];
		sendDemonMessage(table, `${tablePlayer.name} has been freed!`, false, demonTablePlayer.name);
	}
	targetPlayer.socket.emit("possession", doPossess);
	// Update demon on possessed players.
	demonPlayer.socket.emit("possessed players", game.possessedPlayers);
	return true;
}

function processDemonMove(table, player, move) {
	var result = {
		handled: false,
		advance: false,
	};
	switch (table.state) {
		case TABLE_LOBBY:
			break;
		case TABLE_NIGHT:
			if (move.type !== SELECT) {
				return result;
			}
			var success = possessPlayer(table, move.targetId, true);
			result.handled = success;
			result.advance = success;
			break;
		case TABLE_DAY:
			break;
		case TABLE_SECONDING:
			break;
		case TABLE_VOTING:
			break;
		case TABLE_SELECT:
			break;
		case TABLE_INTERFERE:
			if (move.type !== INTERFERE) return result;
			var game = getGameByCode(table.code);
			if (game.interfereUses === 0) return result;

			game.doInterfere = true;
			game.interfereUses -= 1;
			var demonPlayer = getPlayerBySessionId(table.demonId);
			demonPlayer.socket.emit("update interfere", game.interfereUses);

			result.handled = true;
			// We do not advance round, this is handled by timer
			break;
		case TABLE_DISPLAY:
			break;
	}
	return result;
}

function processPlayerMove(table, player, tablePlayer, move) {
	var result = {
		handled: false,
		advance: false,
	};
	switch (table.state) {
		case TABLE_LOBBY:
			console.log(`${move.type} ${move.type === BEGIN} ${isTableOwner(tablePlayer.socketId, table)}`);
			if (move.type !== BEGIN || !isTableOwner(tablePlayer.socketId, table)) {
				return result;
			}
			result.handled = true;
			result.advance = true;
			break;
		case TABLE_NIGHT:
			break;
		case TABLE_DAY:
			if (![PASS, BOARD, WATER, ROD, EXORCISM].includes(move.type)) {
				return result;
			}
			// Player has already moved this round.
			if (tablePlayer.move !== undefined) return result;
			// Resource not available.
			if (table.resources[move.type] < 1) return result;

			// Store move.
			tablePlayer.move = {type: move.type}
			table.currentMove = {
				type: move.type,
				playerId: tablePlayer.sessionId,
				playerName: tablePlayer.name,
			}

			// If player made non-pass move, advance. If player passed, advance if all players have moved.
			result.handled = true;
			result.advance = true; 
			if (move.type === PASS) {
				tablePlayer.move.success = true;
				// If any player hasn't moved yet, do not advance round.
				for (var tablePlayer of table.players) {
					// If any player hasn't voted yet, do not advance round.
					if (tablePlayer.move === undefined && !tablePlayer.isDemon) {
						result.advance = false;
						break;
					}
				}
			}
			break;
		case TABLE_SECONDING:
			if (move.type !== SECOND) return result;
			if (player.sessionId === table.currentMove.playerId) return result;

			tablePlayer.voted = true;
			player.vote = move.vote;
			
			// Advance if any player voted yes, or if all player have voted.
			result.handled = true;
			result.advance = true;
			if (!move.vote) {
				for (var tablePlayer of table.players) {
					// If any player hasn't voted yet, do not advance round.
					if (tablePlayer.sessionId !== table.currentMove.playerId && !tablePlayer.voted && !tablePlayer.isDemon) {
						result.advance = false;
						break;
					}
				}
			}
			break;
		case TABLE_VOTING:
			if (move.type !== VOTE) {
				return result;
			}
			tablePlayer.voted = true;
			player.vote = move.vote;
			// If all non-demon players have voted, advance round.
			result.handled = true;
			result.advance = true;
			for (var tablePlayer of table.players) {
				// If any player hasn't voted yet, do not advance round.
				if (!tablePlayer.voted && !tablePlayer.isDemon) {
					result.advance = false;
					break;
				}
			}
			break;
		case TABLE_SELECT:
			if (move.type !== SELECT) {
				return result;
			}
			// Player cannot select themself.
			if (move.targetId === player.sessionId) return result;
			table.currentMove.targetId = move.targetId;
			result.handled = true;
			result.advance = true;
			break;
		case TABLE_INTERFERE:
			break;
		case TABLE_DISPLAY:
			break;
	}
	return result;
}

function bouncePlayer(socket) {
	socket.emit("update table", false);
}

function updateTable(table) {
	console.log("UPDATING TABLE: " + table.code);
	for (var tablePlayer of table.players) {
		console.log("UPDATING TABLE PLAYER: " + tablePlayer.name + " FOR TABLE: " + table.code);
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) {
			console.log("FOUND AN ACTIVE PLAYER TO UPDATE FOR " + tablePlayer.name + " (" + tablePlayer.sessionId + ") AT TABLE " + table.code);
			player.socket.emit("update table", table);
		} else {
			console.log("DID NOT FIND AN ACTIVE PLAYER FOR PLAYER " + tablePlayer.name + " (" + tablePlayer.sessionId + ") AT TABLE " + table.code);
		}
	}
}

function broadcastMessage(table, msg, sender) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) {
			player.socket.emit("chat msg", msg, sender);
		}
	}
	chatLogs[table.code][GENERAL].push({msg: msg, sender: sender})
}

function sendDemonMessage(table, msg, targetName, demonName) {
	if (targetName) {
		var targetTablePlayer = getTablePlayerByName(targetName, table);
		var targetPlayer = getPlayerBySessionId(targetTablePlayer.sessionId);
		targetPlayer.socket.emit("demon msg", msg, demonName);
		chatLogs[table.code][targetName].push({msg: msg, player: demonName});
	}
	if (demonName) {
		var demonTablePlayer = getTablePlayerByName(demonName, table);
		var demonPlayer = getPlayerBySessionId(demonTablePlayer.sessionId);
		demonPlayer.socket.emit("demon msg", msg, targetName);
		chatLogs[table.code][demonName].push({msg: msg, player: targetName})
	}
}

function clearChats(table) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) {
			player.socket.emit("clear chat", "player-chat");
			player.socket.emit("clear chat", "demon-chat");
		}
	}
}

///// Game logic \\\\\


function advanceRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	switch (table.state) {
		// Start game.
		case TABLE_LOBBY:
			clearMoves(table);
			clearVotes(table);
			var valid = handleNewGame(table);
			if (!valid) { return; }
			table.message = NIGHT_PLAYER_MSG;
			table.demonMessage = NIGHT_DEMON_MSG;
			table.state = TABLE_NIGHT;
			break;
		// Move to day time
		case TABLE_NIGHT:
			// Update table resources for new round.
			handleNewRound(table);
			table.message = DAY_PLAYER_MSG;
			table.demonMessage = DAY_DEMON_MSG;
			table.state = TABLE_DAY;
			break;
		// Handle a player move, either ask for second or move to night.
		case TABLE_DAY:
			clearVotes(table);
			// IF the last move was a pass and we are advancing, must be night.
			if (table.currentMove.type === PASS) {
				table.message = "All players have made their move, night is falling...";
				table.state = TABLE_DISPLAY;
				setTimeout(advanceRound.bind(null, table), 1000 * ROUND_OVER_DISPLAY_SEC);
			} else {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]}, second?`;
				table.demonMessage = undefined;
				table.state = TABLE_SECONDING;
			}
			clearVotes(table);
			break;
		// Move to voting or back to day
		case TABLE_SECONDING:
			var yesVotes = getYesVotes(table);
			if (yesVotes.length > 0) {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]} and ${yesVotes[0]} seconded. Vote now.`;
				table.state = TABLE_VOTING;
			} else {
				var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
				tablePlayer.move.success = false;
				table.message = "No player seconded, the vote fails.";
				table.state = TABLE_DISPLAY;
				setTimeout(advanceRound.bind(null, table), 1000 * FAILED_SECOND_DISPLAY_SEC);
			}
			clearVotes(table);
			break;
		// Move to player select or back to day
		case TABLE_VOTING:
			var yesVotes = getYesVotes(table, true);
			var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
			if (yesVotes.length >= (table.players.length - table.hasExorcised ? 2 : 1) / 2) {
				tablePlayer.move.success = true;
				table.resources[table.currentMove.type] -= 1;
				table.message = `The vote succeeds ${yesVotes.length}-${table.players.length - 1 - yesVotes.length}. ${table.currentMove.playerName} will now select a player.`;
				table.state = TABLE_SELECT;
			} else {
				tablePlayer.move.success = false;
				table.message = `The vote failed ${yesVotes.length}-${table.players.length - 1 - yesVotes.length}`;
				table.state = TABLE_DISPLAY;
				setTimeout(advanceRound.bind(null, table), 1000 * FAILED_VOTE_DISPLAY_SEC);
			}
			break;
		// Move to display result
		case TABLE_SELECT:
			clearVotes(table);

			var targetTablePlayer = getTablePlayerBySessionId(table.currentMove.targetId, table);
			table.message = `${table.currentMove.playerName} is ${ITEM_USE_MSG[table.currentMove.type]} ${targetTablePlayer.name}.`;
			table.state = TABLE_DISPLAY;
			switch (table.currentMove.type) {
				case WATER:
					possessPlayer(table, table.currentMove.targetId, false);
					checkForGameEnd(table);
					break;
				case BOARD:
					var game = getGameByCode(table.code);
					table.demonMessage = `Players are testing ${targetTablePlayer.name}, interfere?`;
					table.state = TABLE_INTERFERE;
					break;
				case ROD:
					var game = getGameByCode(table.code);
					var is = game.possessedPlayers.includes(targetTablePlayer.name) ? "IS" : "IS NOT";
					var message = `${targetTablePlayer.name} ${is} possessed.`;
					var player = getPlayerBySessionId(table.currentMove.playerId);
					player.socket.emit("pop up", message);
					break;
				case EXORCISM:
					var game = getGameByCode(table.code);
					game.interfereUses += 1;
					var demonPlayer = getPlayerBySessionId(table.demonId);
					demonPlayer.socket.emit("update interfere", game.interfereUses);
					possessPlayer(table, table.currentMove.targetId, false);
					checkForGameEnd(table);
					targetTablePlayer.isExorcised = true;
					if (!targetTablePlayer.move) {
						targetTablePlayer.move = {type: PASS};
					}
					table.hasExorcised = true;
					var targetPlayer = getPlayerBySessionId(table.currentMove.targetId);
					targetPlayer.socket.emit("pop up", "You are unconscious until tomorrow, do not speak!");
					break;
			}
			setTimeout(advanceRound.bind(null, table), 1000 * (table.state === TABLE_INTERFERE ? INTERFERE_WAIT_SEC : SHOW_RESULT_DISPLAY_SEC));
			break;
		case TABLE_INTERFERE:
			var targetTablePlayer = getTablePlayerBySessionId(table.currentMove.targetId, table);
			var game = getGameByCode(table.code);
			var is = game.possessedPlayers.includes(targetTablePlayer.name);
			if (game.doInterfere) {
				is = !is;
			}
			game.doInterfere = false;
			var is_msg = is ? "IS" : "IS NOT";
			table.message = `${targetTablePlayer.name} ${is_msg} possessed`;
			table.state = TABLE_DISPLAY;
			table.demonMessage = undefined;
			setTimeout(advanceRound.bind(null, table), 1000 * SHOW_RESULT_DISPLAY_SEC);
			break;
		// Move to 
		case TABLE_DISPLAY:
			clearVotes(table);
			var hasMove = false;
			// If any player can still make a move, go back to day, otherwise go to night.
			for (var tablePlayer of table.players) {
				if (tablePlayer.move === undefined && !tablePlayer.isDemon) {
					hasMove = true;
					break;
				}
			}
			if (hasMove) {
				table.state = TABLE_DAY;
				table.message = DAY_PLAYER_MSG;
				table.demonMessage = DAY_DEMON_MSG;
			} else {
				table.state = TABLE_NIGHT;
				table.message = NIGHT_PLAYER_MSG;
				table.demonMessage = NIGHT_DEMON_MSG;
				clearMoves(table);
			}
			break;
	}
	updateTable(table);	
}

function checkForGameEnd(table) {

}

function handleNewGame(table) {
	if (table.players.length < table.settings.minPlayers) {
		emitErrorToTable(table, `Cannot being game with less than ${table.settings.minPlayers} players!`);
		return false;
	}
	// Game holds things we do not want to send to players, e.g. the deck.
	var game = getGameByCode(table.code);
	if (!game) {
		game = {
			tableCode: table.code,
		};
		games.push(game);
	}
	game.interfereUses = 1;

	game.possessedPlayers = []
	chatLogs[table.code][GENERAL] = [];
	clearChats(table);
	// Select demon
	var index = Math.floor(Math.random() * table.players.length);
	var demon = table.players[index];
	demon.isDemon = true;
	chatLogs[table.code][demon.name] = [];
	table.demonId = demon.sessionId;
	sendDemonMessage(table, "You are the demon!", false, demon.name);
	var demonPlayer = getPlayerBySessionId(table.demonId);
	demonPlayer.socket.emit("update interfere", game.interfereUses);
	// Reset resources
	table.resources = {
		WATER: 0,
	};
	return true;
}

function emitErrorToTable(table, error) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		player.socket.emit("server error", error);
	}
}

function handleNewRound(table) {
	// Clear exorcism
	if (table.hasExorcised) {
		for (var player of table.players) {
			player.isExorcised = false;
		}
	}
	table.hasExorcised = false;
	// Update resources
	table.resources = {
		BOARD: 1,
		WATER: table.resources[WATER]+ 1,
		ROD: 1,
		EXORCISM: 1,
	};
}

function clearMoves(table) {
	for (var tablePlayer of table.players) {
		tablePlayer.move = undefined;
	}
}

function clearVotes(table) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		tablePlayer.voted = false;
		tablePlayer.vote = undefined;
		player.vote = undefined;
	}
}

function getYesVotes(table, makePublic) {
	yesVotes = [];
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) {
			continue;
		}
		if (player.vote) {
			yesVotes.push(tablePlayer.name);
		}
		if (makePublic) {
			tablePlayer.vote = player.vote;
		}
	}
	return yesVotes;
}

///// Utility functions \\\\\

function getAvailableColor(table) {
	for (var color of PLAYER_COLORS) {
		var found = false;
		for (var player of table.players) {
			if (color === player.color) {
				found = true;
				break;
			}
		}
		if (!found) {
			return color;
		}
	}
}

function getTablePlayerBySessionId(sessionId, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table && table.players) {
		for (var player of table.players) {
			if (player.sessionId === sessionId) {
				return player
			}
		}
	}
	return false;
}

function getTablePlayerByName(name, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table && table.players) {
		for (var player of table.players) {
			if (player.name === name) {
				return player
			}
		}
	}
	return false;
}

function isTableOwner(playerId, table) {
	console.log(`${playerId}`);
	console.log(`${table.players[0].socketId}`);
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return table && table.players && table.players.length > 0 && table.players[0].socketId === playerId;
}

function handleNewConnection(socket, sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	console.log("NEW CONNECTION");
	console.log(socket.request.headers.cookie);
	console.log(cookie.parse(socket.request.headers.cookie));
	console.log(cookie.parse(socket.request.headers.cookie)["connect.sid"]);

	var sessionId = DEBUG ? socket.id : cookie.parse(socket.request.headers.cookie)["connect.sid"];
	console.log("SESSION ID: " + sessionId); 
	var player = getPlayerBySessionId(sessionId);
	if (player) {
		socket.emit("server error", "Session for player already exists, you cheater!");
		player.socket.emit("server error", "Session detected in another tab, please don't do that.");
		return;
	}
	player = getInactiveBySessionId(sessionId);
	if (player) {
		players.push(player);
		console.log("FOUND INACTIVE PLAYER! " + sessionId); 
		var index = inactive.indexOf(player);
		if (index > -1) {
			inactive.splice(index, 1);
		}
		player.socket = socket;
		if (player.tableCode) {
			console.log("PLAYER HAS A TABLE CODE! " + sessionId);
			var table = getTableByCode(player.tableCode);
			if (table) {
				console.log("PLAYER'S TABLE (" + player.tableCode + ") EXISTS! " + sessionId);
				var tablePlayer = getTablePlayerBySessionId(sessionId, table);
				tablePlayer.socketId = socket.id;
				tablePlayer.active = true;
				//Update player on the state of the world.
				updateTable(table);
			} else {
				console.log("PLAYER'S TABLE DOES NOT EXIST, REMOVING");
				player.tableCode = undefined;
				bouncePlayer(socket);
			}
		} else {
			bouncePlayer(socket);
		}
	} else {
		console.log("ADDING NEW PLAYER FOR " + sessionId);
		players.push({
			// Session/connection
			socket: socket,
			sessionId: sessionId,
			tableCode: undefined,
			// Secret info
			vote: undefined,
			possessed: false,
		});
		bouncePlayer(socket);
	}
}

function playerDisconnected(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	var index = players.indexOf(player);
	if (index > -1) {
		players.splice(index, 1);
	}
	var table = getTableBySocketId(socket.id);
	if (table) {
		var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
		tablePlayer.active = false;
		var anyPlayers = false;
		for (var tP of table.players) {
			if (tP.active) {
				anyPlayers = true;
				break;
			}
		}
		if (anyPlayers) {
			updateTable(table);
		} else {
			setTimeout(deleteTable.bind(null, table), INACTIVE_TABLE_DELETION_SEC * 1000);
		}
	}
	player.socket = undefined;
	inactive.push(player);
}

{
function getPlayerBySocketId(socketId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < players.length; i++) {
		if (players[i].socket.id === socketId) {
			return players[i];
		}
	}
	return false;
}

function getPlayerBySessionId(sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < players.length; i++) {
		if (players[i].sessionId === sessionId) {
			return players[i];
		}
	}
	return false;
}

function getInactiveBySessionId(sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < inactive.length; i++) {
		if (inactive[i].sessionId === sessionId) {
			return inactive[i];
		}
	}
	return false;
}

function getTableByCode(code) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	code = code.toUpperCase();
	for (var i = 0; i < tables.length; i++) {
		if (tables[i].code === code) {
			return tables[i];
		}
	}
	return false;
}

function getTableBySocketId(socketId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < tables.length; i++) {
		for (var j = 0; j < tables[i].players.length; j++) {
			if (tables[i].players[j].socketId === socketId) {
				return tables[i];
			}
		}
	}
	return false;
}

function getGameByCode(code) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var i = 0; i < games.length; i++) {
		if (games[i].tableCode === code) {
			return games[i];
		}
	}
	return false;
}

function createTableCode() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var code = "";
	var charset = "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
	if (DEBUG) {
		var charset = String.fromCharCode('A'.charCodeAt() + tables.length);
	}
	do {
		code = ""
		for (var i = 0; i < 4; i++) {
			code += charset.charAt(Math.floor(Math.random() * charset.length));
		}
	} while (getTableByCode(code));
	return code;
}
}