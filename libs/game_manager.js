// This file handles all socket.io connections and manages the serverside game logic.
var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var socketio = require("socket.io");
var cookie = require("cookie");

var constants = require("../public/shared/constants");
const e = require("express");

var players = {};
var socketMap = {};

var tables = {};
var chatLogs = {};
const GENERAL = "general";
var games = {};

// Delete tables with all inactive players after 1 hour
const INACTIVE_TABLE_DELETION_SEC = DEBUG ? 1 : 1 * 60 * 60;
const FAILED_SECOND_DISPLAY_SEC = 3;
const FAILED_VOTE_DISPLAY_SEC = 5;
const ROUND_OVER_DISPLAY_SEC = 3;
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

var logFull = true;

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);

	io.on("connection", function(socket) {
		if (!socket.request.headers.cookie) {
			socket.emit("server error", "No cookie!");
			return false;
		}

		socket.emit("init settings", {
			DEBUG: DEBUG,
			code_version: process.env.npm_package_version,
		});

		handleNewConnection(socket);

		socket.on("disconnect", function() {
			playerDisconnected(socket);
		});

		socket.on("make table", function(name, avatarId, color, settings) {
			if (!checkName(socket, name)) return;
			joinTable(socket, createTable(settings), name, avatarId, color);
		});

		socket.on("join table", function(code, name, avatarId, color) {
			if (!checkName(socket, name)) return;
			joinTable(socket, code, name, avatarId, color);
		});

		socket.on("leave table", function() {
			leaveTable(socket);
		});

		socket.on("do move", function(move) {
			handleMove(socket, move);
		});

		socket.on("update settings", function(settings) {
			var table = getTableBySocketId(socket.id);
			if (isTableOwner(socketMap[socket.id], table)) {
				updateSettings(table, settings);
			} else {
				socket.emit("server error", "Only owner can modify table settings!");
			}
		});

		socket.on("chat msg", function(msg, targetName) {
			sendMessage(socket, msg, targetName);
		});

		socket.on("change avatar", function(avatarId) {
			updateAvatar(socket, avatarId);
		});

		socket.on("change color", function(color) {
			updateColor(socket, color);
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
		// Game
		state: constants.states.LOBBY,
		message: undefined,
		demonMessage: undefined,
		resources: [],
		timers: [],
		demonId: undefined,
		currentMove: undefined,
	};
	updateSettings(table, settings);
	chatLogs[table.code] = [];
	chatLogs[table.code][GENERAL] = [];
	tables[table.code] = table;
	return table.code;
}

function makeTableCode() {
	const charset = DEBUG ? String.fromCharCode('A'.charCodeAt() + Object.keys(tables).length) : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
	const codeLen = 4;
	let code = "";
	for (var i = 0; i < codeLen; i++) {
		code += charset.charAt(Math.floor(Math.random() * charset.length));
	}
	return code;
}

function createTableCode() {
	do {
		code = makeTableCode();
	} while (code in tables);
	return code;
}

function joinTable(socket, code, name, avatarId, color) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	var player = getPlayerBySocketId(socket.id);
	if (!player) return false;

	var table = getTableByCode(code);
	if (!table) {
		player.socket.emit("server error", "Table " + code + " not found!");
		return false;
	}
	if (table.players.length >= table.settings.maxPlayers) {
		player.socket.emit("server error", "Table " + code + " full!");
		return false;
	}
	if (table.state !== constants.states.LOBBY) {
		player.socket.emit("server error", "Table " + code + " game in progress!");
		return false;
	}
	if (table.players.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim())) {
		player.socket.emit("server error", "Player with name '" + name + "' already exists at table " + code);
		return false;
	}

	// Add player to the table.
	player.tableCode = code;
	if (!color || table.players.find(p => p.color === color)) color = getAvailableColor(table);
	table.players.push({
		// Session
		sessionId: player.sessionId,
		active: true,
		// Settings
		name: name,
		avatarId: (avatarId || avatarId === 0) ? avatarId : Math.floor(Math.random() * constants.AVATAR_COUNT),
		color: color,
		// Game
		isDemon: false,
		move: undefined,
		voted: false,
	});
	// Update player on the current state of the world.
	updateTable(table);
	chatLogs[table.code][GENERAL].map(l => socket.emit("chat msg", l.msg, l.sender));
}

function leaveTable(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	const player = getPlayerBySocketId(socket.id);
	if (!player) return;

	const table = getTableByCode(player.tableCode);
	if (!table) return;

	if (table.state !== constants.states.LOBBY) {
		player.socket.emit("server error", "Can not leave table while a game is in progress!");
		return;
	}

	// Remove player.
	removeByValue(table.players, table.players.find(p => p.sessionId === player.sessionId));

	if (table.players.length === 0) {
		deleteTable(table);
	} else {
		updateTable(table);
	}
	clearTable(socket);
}

function updateSettings(table, settings) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (!table) { return false; }
	table.settings = settings;
	table.itemsInUse = [];
	for (var item in table.settings.items) {
		if (table.settings.items[item]) table.itemsInUse.push(item);
	}
	updateTable(table);
}

function updateAvatar(socket, avatarId) {
	if (avatarId < 0 || avatarId >= constants.AVATAR_COUNT) return;
	var player = getPlayerBySocketId(socket.id);
	if (!player) return;
	var table = getTableByCode(player.tableCode);
	if (!table) return;
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
	tablePlayer.avatarId = avatarId;
	updateTable(table);
}

function updateColor(socket, color) {
	if (!constants.PLAYER_COLORS.includes(color)) return;
	var table = getTableBySocketId(socket.id);
	if (table.players.find(p => p.color === color)) return;
	var player = getPlayerBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
	tablePlayer.color = color;
	updateTable(table);
}

///// Comms \\\\\

function updateTable(table) {
	for (var tablePlayer of table.players) {
		if (!tablePlayer.active) continue;
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) player.socket.emit("update table", table);
	}
}

function sendMessage(socket, msg, targetName) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);

	if (tablePlayer.isDemon) {
		if (!targetName) return;
		sendDemonMessage(table, msg, targetName);
	} else {
		broadcastMessage(table, msg, tablePlayer.name);
	}
}

function broadcastMessage(table, msg, sender) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) player.socket.emit("chat msg", msg, sender);
	}
	chatLogs[table.code][GENERAL].push({msg: msg, sender: sender})
}

function sendDemonMessage(table, msg, targetName) {
	var targetTablePlayer = getTablePlayerByName(targetName, table);
	var targetPlayer = getPlayerBySessionId(targetTablePlayer.sessionId);
	targetPlayer.socket.emit("demon msg", msg);
	var demonPlayer = getPlayerBySessionId(table.demonId);
	demonPlayer.socket.emit("demon msg", msg, targetName);
	chatLogs[table.code][targetName].push({msg: msg});
}

function clearChats(table) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (player) {
			player.socket.emit("clear chat", "player-chat");
			player.socket.emit("clear chat", "game-log");
			player.socket.emit("clear chat", "demon-chat");
		}
	}
}

function clearTimer(table, timer) {
	const game = getGameByCode(table.code);
	if (!game) return;
	if (game.timers[timer]) clearTimeout(game.timers[timer]);
	game.timers[timer] = undefined;
	table.timers[timer] = false;
}

///// Game logic \\\\\

function handleMove(socket, move) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) return;
	var table = getTableByCode(player.tableCode);
	if (!table) return;
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);

	var result = tablePlayer.isDemon ? handleDemonMove(table, player, move) : handlePlayerMove(table, player, tablePlayer, move);
	if (result.advance) {
		advanceState(table);
	} else if (result.handled) {
		updateTable(table);
	} else {
		console.error(`Move not handled! State: ${table.state}, move: ${move}`);
	}
}

function handleDemonMove(table, player, move) {
	var result = {
		handled: false,
		advance: false,
	};
	switch (table.state) {
		case constants.states.LOBBY:
			break;
		case constants.states.DEMON_SELECTION:
			break;
		case constants.states.NIGHT:
			if (move.type !== constants.moves.SELECT) return result;
			var game = getGameByCode(table.code);
			if (game.smudgedPlayer === move.targetName) return result;
			var targetTablePlayer = getTablePlayerByName(move.targetName, table);
			if (targetTablePlayer.isPurified) return result;
			var success = possessPlayer(table, move.targetName, true);
			result.handled = success;
			result.advance = success;
			break;
		case constants.states.DISCUSS:
			break;
		case constants.states.DAY:
			break;
		case constants.states.SECONDING:
			break;
		case constants.states.VOTING:
			break;
		case constants.states.SELECT:
			break;
		case constants.states.INTERFERE:
			if (move.type !== constants.moves.INTERFERE) return result;
			var game = getGameByCode(table.code);
			if (!game.interfereUses[table.currentMove.type]) return;
			game.doInterfere = move.saltFlip ? (move.saltFlip[0] || move.saltFlip[1]) : move.vote;
			game.saltFlip = move.saltFlip;
			result.handled = true;
			// We do not advance round, this is handled by timer
			break;
		case constants.states.DISPLAY:
			break;
		case constants.states.END:
			break;
	}
	return result;
}

function handlePlayerMove(table, player, tablePlayer, move) {
	var result = {
		handled: false,
		advance: false,
	};
	switch (table.state) {
		case constants.states.LOBBY:
			if (move.type !== constants.moves.BEGIN) return result;
			if (!isTableOwner(tablePlayer.sessionId, table)) return result;
			if (table.players.length < table.settings.minPlayers) {
				player.socket.emit("server error", `Cannot being game with less than ${table.settings.minPlayers} players!`);
				return result;
			}
			if (table.players.length > table.settings.maxPlayers) {
				player.socket.emit("server error", `Cannot being game with more than ${table.settings.maxPlayers} players!`);
				return result;
			}
			result.handled = true;
			result.advance = true;
			break;
		case constants.states.DEMON_SELECTION:
			if (move.type !== constants.moves.ACCEPT_DEMON) return result;
			var game = getGameByCode(table.code);
			if (!game) return result;
			if (tablePlayer.name !== game.demonCandidate) return result;
			result.handled = true;
			result.advance = move.accept;
			if (move.accept) {
				game.demonCandidates = undefined;
				game.demonCandidate = undefined;

				tablePlayer.isDemon = true;
				table.demonId = tablePlayer.sessionId;
				// TODO: make update table emit demonState to demon, remove this.
				player.socket.emit("update interfere", game.interfereUses);
				broadcastMessage(table, `<c>${tablePlayer.name}</c> is the demon!`);
			} else {
				selectDemonCandidate(table);
			}
			break;
		case constants.states.NIGHT:
			break;
		case constants.states.DISCUSS:
			if (move.type != constants.moves.READY) return result;

			var game = getGameByCode(table.code);
			game.votes[tablePlayer.name] = true;

			result.handled = true;
			result.advance = Object.keys(game.votes).length === table.players.length - 1;
			break;
		case constants.states.DAY:
			if (!(move.type === constants.moves.PASS || move.type === constants.moves.USE_ITEM && table.itemsInUse.includes(move.item))) return result;
			// If using turn order, only current player can move.
			if (table.settings.turnOrder && currentPlayer(table).name !== tablePlayer.name) return result;
			// Player has already moved this round.
			if (tablePlayer.move) return result;
			// Resource not available.
			if (table.resources[move.item] < 1) return result;

			// Store move.
			result.handled = true;
			if (move.type === constants.moves.PASS) {
				tablePlayer.move = {type: constants.moves.PASS, success: true};
				// If using turn order, always advance. Otherwise, if player passed, check for round end.
				if (!table.settings.turnOrder) {
					// If any player hasn't moved yet, do not advance round.
					for (var tablePlayer of table.players) {
						// If any player hasn't voted yet, do not advance round.
						if (tablePlayer.move === undefined && !tablePlayer.isDemon) return result;
					}
				}
			} else {
				tablePlayer.move = {type: move.item};
				table.currentMove = {
					type: move.item,
					playerId: tablePlayer.sessionId,
					playerName: tablePlayer.name,
				};
			}
			result.advance = true;
			break;
		case constants.states.SECONDING:
			if (move.type !== constants.moves.SECOND) return result;
			if (player.sessionId === table.currentMove.playerId) return result;
			if (tablePlayer.isExorcised) return result;

			tablePlayer.voted = true;
			var game = getGameByCode(table.code);
			game.votes[tablePlayer.name] = move.vote;
						
			// Advance if any player voted yes, or if all player have voted.
			result.handled = true;
			if (!move.vote) {
				for (var tablePlayer of table.players) {
					// If any player hasn't voted yet, do not advance round.
					if (tablePlayer.sessionId !== table.currentMove.playerId && !tablePlayer.isExorcised && !tablePlayer.voted && !tablePlayer.isDemon) return result;
				}
			}
			result.advance = true;
			break;
		case constants.states.VOTING:
			if (move.type !== constants.moves.VOTE) return result;
			if (tablePlayer.isExorcised) return result;

			tablePlayer.voted = true;
			var game = getGameByCode(table.code);
			game.votes[tablePlayer.name] = move.vote;
			
			// If all non-demon players have voted, advance round.
			result.handled = true;
			for (var tablePlayer of table.players) {
				// If any player hasn't voted yet, do not advance round.
				if (!tablePlayer.voted && !tablePlayer.isDemon && !tablePlayer.isExorcised) return result;
			}
			result.advance = true;
			break;
		case constants.states.SELECT:
			if (move.type !== constants.moves.SELECT) return result;
			if (table.currentMove.playerName !== tablePlayer.name) return result;
			if (table.currentMove.type === constants.items.SALT) {
				// Player first selects salt line (shows to all users), then submit separately.
				if (move.line) {
					// Validate player input
					if (move.line.start === undefined || move.line.start < 0 || move.line.start > table.players.length - 1) move.line.start = undefined;
					if (move.line.end === undefined || move.line.end < 0 || move.line.end > table.players.length - 1) move.line.end = undefined;
					if (move.line.start !== undefined && move.line.end !== undefined) {
						for (var i = -1; i <= 1; i++) {
							if ((move.line.start + i).mod(table.players.length - 1) === move.line.end) move.line.end = undefined;
						}
					}
					table.saltLine = move.line;
					result.handled = true;
					return result;
				} else {
					if (table.saltLine.start === undefined || table.saltLine.end === undefined) return result;
					table.currentMove.targetName = "";
				}
			} else {
				// Player cannot select themself.
				if (move.targetName === tablePlayer.name) return result;
				table.currentMove.targetName = move.targetName;
			}
			result.handled = true;
			result.advance = true;
			break;
		case constants.states.INTERPRET:
			if (move.type !== constants.moves.INTERPRET) return result;
			if (tablePlayer.name !== table.currentMove.playerName) return result;
			var game = getGameByCode(table.code);
			game.rodDisplay = move.choice;
			result.handled = true;
			// We do not advance round, this is handled by timer
		case constants.states.INTERFERE:
			break;
		case constants.states.DISPLAY:
			break;
		case constants.states.END:
			if (move.type !== constants.moves.FINISH || !isTableOwner(tablePlayer.sessionId, table)) return result;
			result.handled = true;
			result.advance = true;
			break;
	}
	return result;
}

function advanceState(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	clearTimer(table, constants.timers.MOVE);

	switch (table.state) {
		// Start game.
		case constants.states.LOBBY:
			handleNewGame(table);
			table.message = DEMON_SELECTION_MSG;
			table.state = constants.states.DEMON_SELECTION;
			break;
		case constants.states.DEMON_SELECTION:
			handleNewRound(table);
			break;
		// Move to day time
		case constants.states.NIGHT:
			table.state = constants.states.DISCUSS;
			table.message = DISCUSS_PLAYER_MSG;
			table.demonMessage = DISCUSS_DEMON_MSG;

			// Clear over-night protection.
			var game = getGameByCode(table.code);
			game.smudgedPlayer = undefined;
			var demonPlayer = getPlayerBySessionId(table.demonId);
			demonPlayer.socket.emit("smudged player");

			table.players.forEach(function (player) {
				player.isSmudged = false;
				player.isPurified = false;
			});

			autoAdvanceState(table, table.settings.times[constants.times.DISCUSS], true);
			break;
		case constants.states.DISCUSS:
			clearVotes(table);
			table.state = constants.states.DAY;

			if (table.settings.turnOrder) {
				table.currentPlayer = table.startPlayer;
				table.message = `It is ${currentPlayer(table).name}'s turn to select a tool`;
				table.demonMessage = undefined;
				broadcastMessage(table, `It is <c>${currentPlayer(table).name}</c>'s turn to select a tool`);
				autoAdvanceState(table, table.settings.times[constants.times.TURN], true);
			} else {
				table.message = DAY_PLAYER_MSG;
				table.demonMessage = DAY_DEMON_MSG;
				autoAdvanceRound(table);
			}
			break;
		// Handle a player move, either ask for second or move to night.
		case constants.states.DAY:
			table.demonMessage = undefined;
			clearVotes(table);
			if (table.currentMove) {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]}, second?`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]}, second?`);
				table.state = constants.states.SECONDING;
				autoAdvanceState(table, table.settings.times[constants.times.SECOND], true);
			} else if (table.settings.turnOrder) {
				var current = currentPlayer(table);
				table.message = `${current.name} ${currentPlayer.move ? "passes": "ran out of time"}`; 
				current.move = {type: constants.moves.PASS};
				broadcastMessage(table, `<c>${current.name}</c> ${table.currentMove ? "passes": "ran out of time"}`);
				table.state = constants.states.DISPLAY;
				autoAdvanceState(table, PASS_DISPLAY_SEC);
			} else {
				// If the last move was a pass and we are advancing, must be night.
				table.message = "All players have made their move, night is falling...";
				table.state = constants.states.DISPLAY;
				clearTimer(table, constants.timers.ROUND);
				autoAdvanceState(table, ROUND_OVER_DISPLAY_SEC);
			}
			clearVotes(table);
			break;
		// Move to voting or back to day
		case constants.states.SECONDING:
			var tally = tallyVotes(table);
			if (tally.yes.length > 0) {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]} and ${tally.yes[0]} seconded. Vote now.`;
				broadcastMessage(table, `<c>${tally.yes[0]}</c> seconds <c>${table.currentMove.playerName}</c>'s proposal`);
				table.state = constants.states.VOTING;
				autoAdvanceState(table, table.settings.times[constants.times.VOTE], true);
			} else {
				var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
				tablePlayer.move.success = false;
				table.message = `No player seconds ${table.currentMove.playerName}'s proposal`
				broadcastMessage(table, `No player seconds <c>${table.currentMove.playerName}</c>'s proposal`);
				table.state = constants.states.DISPLAY;
				autoAdvanceState(table, FAILED_SECOND_DISPLAY_SEC);
			}
			clearVotes(table);
			break;
		// Move to player select or back to day
		case constants.states.VOTING:
			var tally = tallyVotes(table, true);
			var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
			if (tally.yes.length >= tally.no.length) {
				tablePlayer.move.success = true;
				var action = table.currentMove.type === constants.items.SALT ? "draw a line" : "select a target";
				table.message = `The vote succeeds ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}. ${table.currentMove.playerName} will now ${action}.`;
				broadcastMessage(table, `The vote succeeds ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}.`);
				table.state = constants.states.SELECT;
				autoAdvanceState(table, table.settings.times[constants.times.SELECT], true);
			} else {
				tablePlayer.move.success = false;
				table.message = `The vote fails ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}`;
				broadcastMessage(table, `The vote fails ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}.`);
				table.state = constants.states.DISPLAY;
				autoAdvanceState(table, FAILED_VOTE_DISPLAY_SEC);
			}
			if (tally.yes.length > 0) broadcastMessage(table, `Yes: ${tally.yes.map(p => `<c>${p}</c>`).join(", ")}`);
			if (tally.no.length > 0) broadcastMessage(table, `No: ${tally.no.map(p => `<c>${p}</c>`).join(", ")}`);
			if (tally.abstain.length > 0) broadcastMessage(table, `Abstain: ${tally.abstain.map(p => `<c>${p}</c>`).join(", ")}`);
			break;
		// Move to display result
		case constants.states.SELECT:
			table.state = constants.states.DISPLAY;

			if (table.currentMove.targetName || (table.saltLine.start !== undefined && table.saltLine.end !== undefined)) {
				var target = table.currentMove.targetName ? ` ${table.currentMove.targetName}` : "";
				table.message = `${table.currentMove.playerName} is ${ITEM_USE_MSG[table.currentMove.type]}${target}.`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> is ${ITEM_USE_MSG[table.currentMove.type]}<c>${target}</c>.`);
				table.resources[table.currentMove.type] -= 1;

				switch (table.currentMove.type) {
					case constants.items.WATER:
						possessPlayer(table, table.currentMove.targetName, false);
						var targetTablePlayer = getTablePlayerByName(table.currentMove.targetName, table);
						targetTablePlayer.isPurified = table.settings.waterPurify;
						break;
					case constants.items.BOARD:
					case constants.items.ROD:
					case constants.items.EXORCISM:
					case constants.items.SALT:
					case constants.items.SMUDGE:
						table.state = constants.states.INTERFERE;
						break;
				}
			} else {
				var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
				var action = table.currentMove.type === constants.items.SALT ? "complete a line" : "select a target";
				table.message = `${table.currentMove.playerName} failed to ${action} and forfeits their move.`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> failed to ${action} and forfeits their move.`);
				tablePlayer.move.success = false;
			}
			if (table.state === constants.states.INTERFERE) {
				autoAdvanceState(table, table.settings.times[constants.times.INTERFERE], true);
			} else {
				autoAdvanceState(table, SHOW_RESULT_DISPLAY_SEC);
			}
			break;
		case constants.states.INTERFERE:
			var game = getGameByCode(table.code);
			var targetTablePlayer = getTablePlayerByName(table.currentMove.targetName, table);
			table.state = constants.states.DISPLAY;

			if (game.doInterfere) { 
				game.anyInterfere = true;
				game.interfereUses[table.currentMove.type] -= 1;
			}
			var demonPlayer = getPlayerBySessionId(table.demonId);
			demonPlayer.socket.emit("update interfere", game.interfereUses);

			switch (table.currentMove.type) {
				case constants.items.BOARD:
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					table.message = `The board reveals that ${targetTablePlayer.name} ${is ? "IS" : "IS NOT"} possessed`;
					broadcastMessage(table, `The board reveals that <c>${targetTablePlayer.name}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
					break;
				case constants.items.ROD:
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					game.rodResult = is;
					game.rodDisplay = undefined;
					table.message = `${table.currentMove.playerName} is interpreting the results of the divining rod`;
					var tablePlayer = getTablePlayerByName(table.currentMove.playerName, table);
					var player = getPlayerBySessionId(tablePlayer.sessionId);
					player.socket.emit("rod", is);
					table.state = constants.states.INTERPRET;
					table.timers[constants.timers.MOVE] = getTimerValue(table.settings.times[constants.times.INTERPRET]);
					break;
				case constants.items.EXORCISM:
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					table.message = `It appears that ${targetTablePlayer.name} ${is ? "IS" : "IS NOT"} possessed`;
					broadcastMessage(table, `It appears that <c>${targetTablePlayer.name}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
					if (!game.doInterfere) possessPlayer(table, table.currentMove.targetName, false);

					targetTablePlayer.isExorcised = true;
					if (!targetTablePlayer.move) targetTablePlayer.move = {type: constants.moves.PASS};
					var targetPlayer = getPlayerBySessionId(targetTablePlayer.sessionId);
					targetPlayer.socket.emit("pop up", "You are unconscious until tomorrow, do not speak!");
					break;
				case constants.items.SALT:
					// Collect salt groups.
					var groups = [[], []];
					table.saltLine.result = [false, false];
					var currGroup = table.saltLine.start < table.saltLine.end ? 1 : 0;
					var pastDemon = false;
					for (var i = 0; i < table.players.length; i++) {
						if (table.players[i].isDemon) {
							pastDemon = true;
							continue;
						}
						groups[currGroup].push(table.players[i].name);
						table.saltLine.result[currGroup] |= game.possessedPlayers.includes(table.players[i].name)
						var saltIndex = (i - (pastDemon ? 1 : 0)).mod(table.players.length - 1);
						if (saltIndex === table.saltLine.start || saltIndex === table.saltLine.end) {
							currGroup = 1 - currGroup;
						}
					}
					// If interference, flip results.
					if (game.saltFlip[0]) table.saltLine.result[0] = !table.saltLine.result[0];
					if (game.saltFlip[1]) table.saltLine.result[1] = !table.saltLine.result[1];
					// No message, show visually.
					table.message = "";
					broadcastMessage(table, `Group: ${groups[0].map(p => `<c>${p}</c>`).join(", ")} ${table.saltLine.result[0] ? "DOES" : "DOES NOT"} contain a possessed player.`);
					broadcastMessage(table, `Group: ${groups[1].map(p => `<c>${p}</c>`).join(", ")} ${table.saltLine.result[1] ? "DOES" : "DOES NOT"} contain a possessed player.`);
					break;
				case constants.items.SMUDGE:
					table.message = `${targetTablePlayer.name} has been warded against possession next round.`;
					targetTablePlayer.isSmudged = true;
					if (!(game.doInterfere || game.possessedPlayers.includes(table.currentMove.playerName))) {
						game.smudgedPlayer = targetTablePlayer.name;
						demonPlayer.socket.emit("smudged player", targetTablePlayer.name);
					}
					break;
			}
			var wait = SHOW_RESULT_DISPLAY_SEC;
			if (table.state === constants.states.INTERPRET) wait = table.settings.times[constants.times.INTERPRET];
			if (table.currentMove.type === constants.items.SALT) wait *= 2;
			autoAdvanceState(table, wait);
			break;
		case constants.states.INTERPRET:
			var game = getGameByCode(table.code);
			if (game.rodDisplay === undefined) {
				table.message = `${table.currentMove.playerName} chooses not to share if ${table.currentMove.targetName} is possessed`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> chooses not to share if <c>${table.currentMove.targetName}</c> is possessed`);
			} else {
				var is = game.rodResult;
				if (!game.rodDisplay) is = !is; 
				table.message = `${table.currentMove.playerName} reports that ${table.currentMove.targetName} ${is ? "IS" : "IS NOT"} possessed`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> reports that <c>${table.currentMove.targetName}</c> ${is ? "IS" : "IS NOT"} possessed`);
			}
			table.state = constants.states.DISPLAY;
			autoAdvanceState(table, SHOW_RESULT_DISPLAY_SEC);
			break;
		case constants.states.DISPLAY:
			handleTurnEnd(table);
			break;
		case constants.states.END:
			clearMoves(table);
			table.state = constants.states.LOBBY;
			table.msg = undefined;
			// Reset players.
			for (var tablePlayer of table.players) {
				tablePlayer.isDemon = false;
				tablePlayer.isDamned = false;
				tablePlayer.isExorcised = false;
				tablePlayer.isSmudged = false;
				tablePlayer.wasSmudged = false;
				tablePlayer.isPurified = false;
				tablePlayer.wasPurified = false;
			}
			break;
	}
	updateTable(table);	
}

function autoAdvanceState(table, delay, display=false) {
	const game = getGameByCode(table.code);
	if (!game) return;
	game.timers[constants.timers.MOVE] = Number(setTimeout(advanceState.bind(null, table), 1000 * delay))
	if (display) table.timers[constants.timers.MOVE] = getTimerValue(delay);
}

function autoAdvanceRound(table) {
	const game = getGameByCode(table.code);
	if (!game) return;
	game.timers[constants.timers.ROUND] = Number(setTimeout(timeoutRound.bind(null, table), 1000 * table.settings.times[constants.times.ROUND]));
	table.timers[constants.timers.ROUND] = getTimerValue(table.settings.times[constants.times.ROUND]);
}

function timeoutRound(table) {
	const game = getGameByCode(table.code);
	if (!game) return;
	game.timeout = true;
	if (table.state === constants.states.DAY) {
		table.message = "The sun is settings, night is falling...";
		table.state = constants.states.DISPLAY;
		autoAdvanceState(table, ROUND_OVER_DISPLAY_SEC);
		updateTable(table);
	}
}

function handleTurnEnd(table) {
	var game = getGameByCode(table.code);
	game.doInterfere = false;
	game.saltFlip = [false, false];
	
	table.saltLine = {start: undefined, end: undefined};
	table.currentMove = undefined;
	clearVotes(table);
	advanceCurrentPlayer(table);

	if (game.possessedPlayers.length === 0) {
		table.state = constants.states.END;
		table.message = PLAYER_WIN_MESSAGE;
		var winners = [];
		for (var tablePlayer of table.players) {
			if (tablePlayer.isDemon || game.damnedPlayers.includes(tablePlayer.name)) {
				tablePlayer.isDamned = true;
			} else {
				winners.push(tablePlayer.name);
			}
		}
		broadcastMessage(table, `The virtuous win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
		handleGameEnd(table);
	} else if (isStillDay(table)) {
		table.state = constants.states.DAY;
		if (table.settings.turnOrder) {
			table.message = `It is ${currentPlayer(table).name}'s turn to select a tool`;
			broadcastMessage(table, `It is <c>${currentPlayer(table).name}</c>'s turn to select a tool`);
			autoAdvanceState(table, table.settings.times[constants.times.TURN], true);
		} else {
			table.message = DAY_PLAYER_MSG;
			table.demonMessage = DAY_DEMON_MSG;
		}
	} else if (game.possessedPlayers.length >= (table.players.length - 1) / 2) {
		table.state = constants.states.END;
		table.message = DEMON_WIN_MESSAGE;
		var winners = [];
		for (var tablePlayer of table.players) {
			if (tablePlayer.isDemon || game.possessedPlayers.includes(tablePlayer.name)) {
				tablePlayer.isDamned = true;
				winners.push(tablePlayer.name);
			}
		}
		broadcastMessage(table, `The damned win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
		handleGameEnd(table);
	} else {
		handleNewRound(table);
	}
}

function isStillDay(table) {
	if (table.settings.turnOrder) {
		if (table.currentPlayer === table.startPlayer) return false;
	} else {
		var game = getGameByCode(table.code);
		if (!game || game.timeout) return false;
	}

	// Check if any player can make a move.
	var resourceCount = 0;
	for (var item of table.itemsInUse) {
		resourceCount += table.resources[item];
	}
	if (resourceCount === 0) return false;

	// If any player can still make a move, go back to day, otherwise go to night.
	for (var tablePlayer of table.players) {
		if (tablePlayer.move === undefined && !tablePlayer.isDemon && !tablePlayer.isExorcised) {
			return true;
		}
	}
	return false;
}

function handleGameEnd(table) {
	table.demonId = undefined;
	clearMoves(table);
	clearTimer(table, constants.timers.MOVE);
	clearTimer(table, constants.timers.ROUND);
}

function handleNewGame(table) {
	clearMoves(table);
	clearVotes(table);

	// Game holds secret information.
	games[table.code] = {
		interfereUses: {
			[constants.items.WATER]: 0,
			[constants.items.BOARD]: 1,
			[constants.items.ROD]: 1,
			[constants.items.EXORCISM]: 1,
			[constants.items.SALT]: 1,
			[constants.items.SMUDGE]: 1,
		},
		possessedPlayers: [],
		timers: {},
		votes: {},
	}

	// Clear chat logs
	chatLogs[table.code] = [];
	chatLogs[table.code][GENERAL] = [];
	clearChats(table);

	// Select demon candidate
	selectDemonCandidate(table, true);

	// Reset resources
	table.resources = {
		[constants.items.WATER]: -1,
	};
	table.round = 0;
	table.saltLine = {start: undefined, end: undefined};

	// Reset timers
	table.timers = {
		[constants.timers.ROUND]: false,
		[constants.timers.MOVE]: false,
	};

	// Set turn order
	table.startPlayer = undefined;
}

function selectDemonCandidate(table, start=false) {
	var game = getGameByCode(table.code);
	if (start) {
		game.demonCandidates = [];
		game.demonCandidate = undefined;
	}
	if (game.demonCandidate) removeByValue(game.demonCandidates, game.demonCandidate);
	if (game.demonCandidates.length === 0) game.demonCandidates = table.players.map(p => p.name);
	var index = Math.floor(Math.random() * game.demonCandidates.length);
	game.demonCandidate = game.demonCandidates[index];
	var tablePlayer = getTablePlayerByName(game.demonCandidate, table);
	var player = getPlayerBySessionId(tablePlayer.sessionId);
	player.socket.emit("accept demon");
}

function currentPlayer(table) {
	if (!table || !table.settings.turnOrder || table.currentPlayer === undefined) return;
	return table.players[table.currentPlayer];
}

function advanceCurrentPlayer(table) {
	if (!table.settings.turnOrder) return;
	table.currentPlayer = nextPlayer(table, table.currentPlayer);
}

function advanceStartPlayer(table) {
	if (!table.settings.turnOrder) return;
	if (table.startPlayer === undefined) table.startPlayer = Math.floor(Math.random() * table.players.length);
	table.startPlayer = nextPlayer(table, table.startPlayer);
}

function nextPlayer(table, index) {
	do {
		index = (index + 1).mod(table.players.length);
	} while(table.players[index].sessionId === table.demonId || table.players[index].isExorcised);
	return index;
}

function handleNewRound(table) {
	var game = getGameByCode(table.code);

	table.round += 1;
	table.state = constants.states.NIGHT;
	table.demonMessage = NIGHT_DEMON_MSG;

	clearMoves(table);
	clearVotes(table);
	
	if (table.round > 1) {
		table.message = `Night falls... there ${game.anyInterfere ? "WAS" : "WAS NOT"} interference during the round.`;
		broadcastMessage(table, `There <b>${game.anyInterfere ? "WAS" : "WAS NOT"}</b> interference during the round.`);
	} else {
		table.message = NIGHT_PLAYER_MSG;
	}

	game.damnedPlayers = [];
	game.anyInterfere = false;
	game.timeout = false;

	// Clear lasting states
	table.players.forEach(function (player) {
		player.isExorcised = false;
		player.wasSmudged = player.isSmudged;
		player.wasPurified = player.isPurified;
	});

	if (table.settings.turnOrder) {
		advanceStartPlayer(table);
		table.currentPlayer = table.startPlayer;
	}

	// Update resources
	table.resources = {
		[constants.items.BOARD]: 1,
		[constants.items.WATER]: Math.floor(Math.min(table.players.length / 3, table.resources[constants.items.WATER] + 1)),
		[constants.items.ROD]: 1,
		[constants.items.EXORCISM]: 1,
		[constants.items.SALT]: 1,
		[constants.items.SMUDGE]: 1,
	};
}

function possessPlayer(table, targetName, doPossess) {
	var game = getGameByCode(table.code);
	var demonPlayer = getPlayerBySessionId(table.demonId);
	var tablePlayer = getTablePlayerByName(targetName, table);
	var targetPlayer = getPlayerBySessionId(tablePlayer.sessionId);
	if (doPossess) {
		if (game.possessedPlayers.includes(tablePlayer.name)) return false;
		game.possessedPlayers.push(tablePlayer.name);
		chatLogs[table.code][tablePlayer.name] = [];
		sendDemonMessage(table, "You have been possessed!", tablePlayer.name);
	} else {
		if (!game.possessedPlayers.includes(tablePlayer.name)) return false;
		removeByValue(game.possessedPlayers, tablePlayer.name);
		game.damnedPlayers.push(tablePlayer.name);
	}
	demonPlayer.socket.emit("possessed players", game.possessedPlayers);
	targetPlayer.socket.emit("possession", doPossess);
	return true;
}

function clearMoves(table) {
	table.players.forEach(p => p.move = undefined);
	table.currentMove = undefined;
}

function clearVotes(table) {
	if (!table) return;
	table.players.forEach(function (player) {
		player.voted = false;
		player.vote = undefined;
	});
	var game = getGameByCode(table.code);
	if (game) game.votes = {};
}

function tallyVotes(table, makePublic) {
	var tally = {
		yes: [],
		no: [],
		abstain: [],
	};
	const game = getGameByCode(table.code);
	for (var tablePlayer of table.players) {
		if (tablePlayer.isDemon) continue;
		if (tablePlayer.isExorcised) continue;

		// Tally vote.
		const vote = game.votes[tablePlayer.name];
		if (vote === undefined) {
			tally.abstain.push(tablePlayer.name);
		} else if (vote) {
			tally.yes.push(tablePlayer.name);
		} else {
			tally.no.push(tablePlayer.name);
		}
		// Show the vote at the end of the round.
		if (makePublic) tablePlayer.vote = vote;
	}
	return tally;
}

///// Utility functions \\\\\

function checkName(socket, name) {
	if (name.match("^[\\d\\w\\s!]+$")) return true;
	socket.emit("server error", `Invalid name: '${name}', alphanumeric only!`);
	return false;
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

function getAvailableColor(table) {
	const tableColors = table.players.map(p => p.color);
	for (var color of constants.PLAYER_COLORS) {
		if (tableColors.includes(color)) continue;
		return color;
	}
}

function isTableOwner(sessionId, table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return table && table.players && table.players.length > 0 && table.players[0].sessionId === sessionId;
}

function removeByValue(arr, val) {
	var index = arr.indexOf(val);
	if (index == -1) return undefined;
	return arr.splice(index, 1)[0];
}

function getTimerValue(sec) {
	return Date.now() + sec * 1000;
}

////// Connection logic \\\\\\\\\\

function handleNewConnection(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	console.log("NEW CONNECTION");
	console.log(cookie.parse(socket.request.headers.cookie)["connect.sid"]);
	let sessionId = DEBUG ? `${socket.id} session` : cookie.parse(socket.request.headers.cookie)["connect.sid"];
	socket.emit("player id", sessionId);

	let player = getPlayerBySessionId(sessionId);
	if (!player) {
		players[sessionId] = {
			socket: socket,
			sessionId: sessionId,
			tableCode: undefined,
		};
		socketMap[socket.id] = sessionId;
		clearTable(socket);
		return
	}

	if (player.active) {
		socket.emit("server error", "Found existing session in another tab.");
		return;
	}

	socketMap[socket.id] = sessionId;
	player.socket = socket;
	player.active = true;

	let table = getTableByCode(player.tableCode);
	if (!table) {
		player.tableCode = undefined;
		clearTable(socket);
	}

	// console.log("PLAYER HAS A TABLE CODE! " + sessionId);
	// console.log("PLAYER'S TABLE (" + player.tableCode + ") EXISTS! " + sessionId);

	var tablePlayer = getTablePlayerBySessionId(sessionId, table);
	tablePlayer.active = true;
	updateTable(table);

	var game = getGameByCode(table.code);
	if (game) {
		// Update demon on state of the world.
		if (tablePlayer.isDemon) {
			player.socket.emit("possessed players", game.possessedPlayers);
			player.socket.emit("update interfere", game.interfereUses);
			player.socket.emit("smudged player", game.smudgedPlayer);
		}
		if (game.possessedPlayers.includes(tablePlayer.name)) player.socket.emit("possession", true);
	}

	for (var chat in chatLogs[table.code]) {
		if (chat === GENERAL) {
			for (var l of chatLogs[table.code][chat]) {
				socket.emit("chat msg", l.msg, l.player);
			}
		} else if (tablePlayer.isDemon || chat === tablePlayer.name) {
			for (var l of chatLogs[table.code][chat]) {
				socket.emit("demon msg", l.msg, l.player);
			}
		}
	}
}

function clearTable(socket) {
	socket.emit("update table", false);
}

function playerDisconnected(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	if (!(socket.id in socketMap)) return;
	const sessionId = socketMap[socket.id]
	delete socketMap[socket.id];

	if (!(sessionId in players)) return;
	const player = players[sessionId];

	player.socket = undefined;
	player.active = false;
	
	// TODO: db interaction
	// TODO: set timer to delete inactive playre

	var table = getTableByCode(player.tableCode);
	if (table) { 
		var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
		tablePlayer.active = false;

		if (table.players.reduce((acc, p) => acc || p.active, false)) {
			updateTable(table);
		} else {
			setTimeout(deleteTable.bind(null, table), INACTIVE_TABLE_DELETION_SEC * 1000);
		}
	}
}

// Getters / setters / deleters -- handles in mem and database interactions

function deleteGame(code) {
	delete games[code];
}

function deleteChat(code) {
	delete chatLogs[code];
}

function deleteTable(table) {
	// Delete game and table.
	deleteGame(table.code);
	deleteChat(table.code);
	delete tables[code];
}

// Simple getters TODO: refactor this?

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
	if (!table) return undefined;
	return table.players.find(p => p.name === name);
}

function getPlayerBySocketId(socketId) {
	return getPlayerBySessionId(socketMap[socketId]);
}

function getPlayerBySessionId(sessionId) {
	return players[sessionId];
}

function getTableByCode(code) {
	if (!code) return undefined;
	return tables[code.toUpperCase()];
}

function getTableBySocketId(socketId) {
	var player = getPlayerBySocketId(socketId);
	return player ? getTableByCode(player.tableCode) : undefined;
}

function getGameByCode(code) {
	return games[code.toUpperCase()];
}