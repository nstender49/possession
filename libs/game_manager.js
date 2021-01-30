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
const FAILED_SECOND_DISPLAY_SEC = 3;
const FAILED_VOTE_DISPLAY_SEC = 5;
const ROUND_OVER_DISPLAY_SEC = 3;
const PASS_DISPLAY_SEC = 2;
const SHOW_RESULT_DISPLAY_SEC = 5;

const WAIT_MSG = "Waiting for players to join...";
const BEGIN_MSG = "Waiting for owner to start game...";
const NIGHT_PLAYER_MSG = "Night falls, the demon is possessing a victim...";
const NIGHT_DEMON_MSG = "Select a victim to possess >:)";
const DISCUSS_PLAYER_MSG ="You sense an evil presence... make a plan to defeat it!"
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

const PLAYER_COLORS = [
	"#fbb7c5", "#8dd304", "#0089cc", "#98178e", "#ed6e01",  
	"#a37e30", "#ed2c34", "#144c2a", "#0046b6", "#512246", "#fdc918", 
	"#4c270c", "#000000", "#ffffff"
];
const AVATAR_COUNT = 50;

// Timers
ROUND_TIMER = "round timer";
MOVE_TIMER = "move timer";
DEMON_TIMER = "demon timer";

// Game states
const INIT = "init";
const MAIN_MENU = "main menu";
const TABLE_LOBBY = "table lobby";
const TABLE_NIGHT = "table night";
const TABLE_DISCUSS = "table discuss"
const TABLE_DAY = "table day";
const TABLE_SECONDING = "table seconding";
const TABLE_VOTING = "table voting"; 
const TABLE_SELECT = "table selecting player";
const TABLE_INTERFERE = "table demon interference"
const TABLE_DISPLAY = "table display result";
const TABLE_END = "table game over";

// Moves players can make
const BEGIN = "BEGIN";
const READY = "READY";
const SECOND = "SECOND";
const VOTE = "VOTE";

const PASS = "PASS";
const BOARD = "BOARD";
const WATER = "WATER";
const ROD = "ROD";
const EXORCISM = "EXORCISM";
const ITEMS = [BOARD, WATER, ROD, EXORCISM];
const SELECT = "SELECT";
const INTERFERE = "INTERFERE";
const FINISH = "FINISH";

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
			updateSettings(socket, settings);
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
		playerColors: [],
		settings: settings,
		// Game
		state: TABLE_LOBBY,
		message: WAIT_MSG,
		demonMessage: undefined,
		resources: [],
		timers: [],
		demonId: undefined,
		currentMove: undefined,
	};
	chatLogs[table.code] = [];
	chatLogs[table.code][GENERAL] = [];
	tables.push(table);
	return table.code;
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

function joinTable(socket, code, name, avatarId, color) {
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
		if (name.toLowerCase() === tablePlayer.name.toLowerCase()) {
			player.socket.emit("server error", "Player with name '" + name + "' already exists at table " + code);
			return false;
		}
	}
	// Add player to the table.
	player.tableCode = code;
	console.log(`ADDING PLAYER WITH SESSIONID ${player.sessionId} AND SOCKETID ${player.socket.id}`);
	if (!color || table.playerColors.includes(color)) color = getAvailableColor(table);
	table.playerColors.push(color);
	table.players.push({
		// Session
		sessionId: player.sessionId,
		socketId: player.socket.id,
		active: true,
		// Settings
		name: name,
		avatarId: (avatarId || avatarId === 0) ? avatarId : Math.floor(Math.random() * AVATAR_COUNT),
		color: color,
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
	// Get player up to speed on chat
	for (var l of chatLogs[table.code][GENERAL]) {
		socket.emit("chat msg", l.msg, l.sender);
	}
}

function leaveTable(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var table = getTableBySocketId(socket.id);
	if (!table) { return false; }

	if (table.state !== TABLE_LOBBY) {
		player.socket.emit("server error", "Can not leave table while a game is in progress!");
		return false;
	}
	// Remove player.
	for (var i = 0; i < table.players.length; i++) {
		if (table.players[i].socketId === socket.id) {
			removeByValue(table.playerColors, table.players[i].color);
			table.players.splice(i, 1);
			break;
		}
	}
	if (table.players.length === 0) {
		deleteTable(table);
	} else {
		table.message = table.players.length < table.settings.minPlayers ? WAIT_MSG : BEGIN_MSG;
		// Update remaining players.
		updateTable(table);
	}
	clearTable(socket);
}

function deleteTable(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Delete game and table.
	var game = getGameByCode(table.code);
	if (game) removeByValue(games, game);
	delete chatLogs[table.code];
	removeByValue(tables, table);
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

function updateAvatar(socket, avatarId) {
	if (avatarId < 0 || avatarId >= AVATAR_COUNT) return;
	var table = getTableBySocketId(socket.id);
	var player = getPlayerBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
	tablePlayer.avatarId = avatarId;
	updateTable(table);
}

function updateColor(socket, color) {
	if (!PLAYER_COLORS.includes(color)) return;
	var table = getTableBySocketId(socket.id);
	if (table.playerColors.includes(color)) return;
	var player = getPlayerBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);
	table.playerColors.push(color);
	removeByValue(table.playerColors, tablePlayer.color);
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
		sendDemonMessage(table, msg, targetName, tablePlayer.name);
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

function clearTimer(table) {
	if (table.timerId) clearTimeout(table.timerId);
	table.timerId = undefined;
	table.timers[MOVE_TIMER] = false;
	table.timers[DEMON_TIMER] = false;
}

function clearRoundTimer(table) {
	if (table.roundTimerId) clearTimeout(table.roundTimerId);
	table.roundTimerId = undefined;
	table.timers[ROUND_TIMER] = false;
}

function emitErrorToTable(table, error) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		player.socket.emit("server error", error);
	}
}

///// Game logic \\\\\

function handleMove(socket, move) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	if (!player) { return; }
	var table = getTableBySocketId(socket.id);
	var tablePlayer = getTablePlayerBySessionId(player.sessionId, table);

	var result = tablePlayer.isDemon ? handleDemonMove(table, player, move) : handlePlayerMove(table, player, tablePlayer, move);
	if (result.advance) {
		var error = advanceRound(table);
		if (error) socket.emit("server error", error);
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
		case TABLE_LOBBY:
			break;
		case TABLE_NIGHT:
			if (move.type !== SELECT) return result;
			var success = possessPlayer(table, move.targetName, true);
			result.handled = success;
			result.advance = success;
			break;
		case TABLE_DISCUSS:
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
			if (!game.interfereUses[table.currentMove.type]) return;

			if (move.vote) { 
				game.anyInterfere = true;
				game.doInterfere = true;
				game.interfereUses[table.currentMove.type] -= 1;
			}
			var demonPlayer = getPlayerBySessionId(table.demonId);
			demonPlayer.socket.emit("update interfere", game.interfereUses);

			result.handled = true;
			// We do not advance round, this is handled by timer

			break;
		case TABLE_DISPLAY:
			break;
		case TABLE_END:
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
		case TABLE_LOBBY:
			if (move.type !== BEGIN || !isTableOwner(tablePlayer.socketId, table)) return result;
			result.handled = true;
			result.advance = true;
			break;
		case TABLE_NIGHT:
			break;
		case TABLE_DISCUSS:
			player.vote = true;
			result.handled = true;
			for (var tablePlayer of table.players) {
				var thePlayer = getPlayerBySessionId(tablePlayer.sessionId);
				if (!tablePlayer.isDemon && !thePlayer.vote) return result;
			}
			result.advance = true;
			break;
		case TABLE_DAY:
			if (![PASS, BOARD, WATER, ROD, EXORCISM].includes(move.type)) {
				return result;
			}
			// If using turn order, only current player can move.
			if (table.settings.turnOrder && currentPlayer(table).name !== tablePlayer.name) return result;
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

			result.handled = true;

			// If using turn order, always advance. Otherwise, if player passed, check for round end.
			if (!table.settings.turnOrder && move.type === PASS) {
				tablePlayer.move.success = true;
				// If any player hasn't moved yet, do not advance round.
				for (var tablePlayer of table.players) {
					// If any player hasn't voted yet, do not advance round.
					if (tablePlayer.move === undefined && !tablePlayer.isDemon) return result;
				}
			}
			result.advance = true;
			break;
		case TABLE_SECONDING:
			if (move.type !== SECOND) return result;
			if (player.sessionId === table.currentMove.playerId) return result;
			if (tablePlayer.isExorcised) return result;

			tablePlayer.voted = true;
			player.vote = move.vote;
			
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
		case TABLE_VOTING:
			if (move.type !== VOTE) return result;
			if (tablePlayer.isExorcised) return result;
			tablePlayer.voted = true;
			player.vote = move.vote;
			// If all non-demon players have voted, advance round.
			result.handled = true;
			for (var tablePlayer of table.players) {
				// If any player hasn't voted yet, do not advance round.
				if (!tablePlayer.voted && !tablePlayer.isDemon && !tablePlayer.isExorcised) return result;
			}
			result.advance = true;
			break;
		case TABLE_SELECT:
			if (move.type !== SELECT) {
				return result;
			}
			// Player cannot select themself.
			if (move.targetNmae === tablePlayer.name) return result;
			table.currentMove.targetName = move.targetName;
			result.handled = true;
			result.advance = true;
			break;
		case TABLE_INTERFERE:
			break;
		case TABLE_DISPLAY:
			break;
		case TABLE_END:
			if (move.type !== FINISH || !isTableOwner(tablePlayer.socketId, table)) return result;
			result.handled = true;
			result.advance = true;
			break;
	}
	return result;
}

function advanceRound(table) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	clearTimer(table);

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
			table.state = TABLE_DISCUSS;
			table.message = DISCUSS_PLAYER_MSG;
			table.demonMessage = DAY_DEMON_MSG;
			table.timers[MOVE_TIMER] = getTimerValue(table.settings.discussTime);
			autoAdvanceRound(table, table.settings.discussTime);
			break;
		case TABLE_DISCUSS:
			clearVotes(table);
			table.state = TABLE_DAY;

			if (table.settings.turnOrder) {
				table.currentPlayer = table.startPlayer;
				table.message = `It is ${currentPlayer(table).name}'s turn to select a tool`;
				broadcastMessage(table, `It is <c>${currentPlayer(table).name}</c>'s turn to select a tool`);
				table.timers[MOVE_TIMER] = getTimerValue(table.settings.moveTime);
				autoAdvanceRound(table, table.settings.moveTime);
			} else {
				table.message = DAY_PLAYER_MSG;
				table.timers[ROUND_TIMER] = getTimerValue(table.settings.roundTime);
				table.roundTimerId = Number(setTimeout(timeoutRound.bind(null, table), 1000 * (table.settings.roundTime + 1)));
			}
			break;
		// Handle a player move, either ask for second or move to night.
		case TABLE_DAY:
			clearVotes(table);
			if (table.currentMove && table.currentMove.type !== PASS) {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]}, second?`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]}, second?`);
				table.demonMessage = undefined;
				table.state = TABLE_SECONDING;
				table.timers[MOVE_TIMER] = getTimerValue(table.settings.secondTime);
				autoAdvanceRound(table, table.settings.secondTime);
			} else if (table.settings.turnOrder) {
				var current = currentPlayer(table);
				table.message = `${current.name} ${table.currentMove ? "passes": "ran out of time"}`; 
				current.move = {type: PASS};
				broadcastMessage(table, `<c>${current.name}</c> ${table.currentMove ? "passes": "ran out of time"}`);
				table.state = TABLE_DISPLAY;
				autoAdvanceRound(table, PASS_DISPLAY_SEC);
			} else {
				// If the last move was a pass and we are advancing, must be night.
				table.message = "All players have made their move, night is falling...";
				table.state = TABLE_DISPLAY;
				clearRoundTimer(table);
				autoAdvanceRound(table, ROUND_OVER_DISPLAY_SEC);
			}
			clearVotes(table);
			break;
		// Move to voting or back to day
		case TABLE_SECONDING:
			var tally = tallyVotes(table);
			if (tally.yes.length > 0) {
				table.message = `${table.currentMove.playerName} wants to ${ITEM_PROPOSE_MSG[table.currentMove.type]} and ${tally.yes[0]} seconded. Vote now.`;
				broadcastMessage(table, `<c>${tally.yes[0]}</c> seconds <c>${table.currentMove.playerName}</c>'s proposal`);
				table.state = TABLE_VOTING;
				table.timers[MOVE_TIMER] = getTimerValue(table.settings.voteTime);
				autoAdvanceRound(table, table.settings.voteTime);
			} else {
				var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
				tablePlayer.move.success = false;
				table.message = `No player seconds ${table.currentMove.playerName}'s proposal`
				broadcastMessage(table, `No player seconds <c>${table.currentMove.playerName}</c>'s proposal`);
				table.state = TABLE_DISPLAY;
				autoAdvanceRound(table, FAILED_SECOND_DISPLAY_SEC);
			}
			clearVotes(table);
			break;
		// Move to player select or back to day
		case TABLE_VOTING:
			var tally = tallyVotes(table, true);
			var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
			if (tally.yes.length >= tally.no.length) {
				tablePlayer.move.success = true;
				table.message = `The vote succeeds ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}. ${table.currentMove.playerName} will now select a player.`;
				broadcastMessage(table, `The vote succeeds ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}.`);
				table.state = TABLE_SELECT;
				table.timers[MOVE_TIMER] = getTimerValue(table.settings.selectTime);
				autoAdvanceRound(table, table.settings.selectTime);
			} else {
				tablePlayer.move.success = false;
				table.message = `The vote fails ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}`;
				broadcastMessage(table, `The vote fails ${tally.yes.length}-${tally.no.length}-${tally.abstain.length}.`);
				table.state = TABLE_DISPLAY;
				autoAdvanceRound(table, FAILED_VOTE_DISPLAY_SEC);
			}
			if (tally.yes.length > 0) broadcastMessage(table, `Yes: ${tally.yes.map(p => `<c>${p}</c>`).join(", ")}`);
			if (tally.no.length > 0) broadcastMessage(table, `No: ${tally.no.map(p => `<c>${p}</c>`).join(", ")}`);
			if (tally.abstain.length > 0) broadcastMessage(table, `Abstain: ${tally.abstain.map(p => `<c>${p}</c>`).join(", ")}`);
			break;
		// Move to display result
		case TABLE_SELECT:
			clearVotes(table);
			table.state = TABLE_DISPLAY;

			if (table.currentMove.targetName) {
				var targetTablePlayer = getTablePlayerByName(table.currentMove.targetName, table);
				table.message = `${table.currentMove.playerName} is ${ITEM_USE_MSG[table.currentMove.type]} ${targetTablePlayer.name}.`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> is ${ITEM_USE_MSG[table.currentMove.type]} <c>${targetTablePlayer.name}</c>.`);
				table.resources[table.currentMove.type] -= 1;

				switch (table.currentMove.type) {
					case WATER:
						possessPlayer(table, table.currentMove.targetName, false);
						break;
					case BOARD:
					case ROD:
					case EXORCISM:
						table.state = TABLE_INTERFERE;
						table.demonMessage = undefined;
						table.timers[DEMON_TIMER] = getTimerValue(table.settings.interfereTime);
						var game = getGameByCode(table.code);
						game.doInterfere = false;
						break;
				}
			} else {
				var tablePlayer = getTablePlayerBySessionId(table.currentMove.playerId, table);
				table.message = `${table.currentMove.playerName} failed to select a target and forfeits their move.`;
				broadcastMessage(table, `<c>${table.currentMove.playerName}</c> failed to select a target and forfeits their move.`);
				tablePlayer.move.success = false;
			}
			autoAdvanceRound(table, table.state === TABLE_INTERFERE ? table.settings.interfereTime + 1 : SHOW_RESULT_DISPLAY_SEC);
			break;
		case TABLE_INTERFERE:
			var game = getGameByCode(table.code);
			var targetTablePlayer = getTablePlayerByName(table.currentMove.targetName, table);
			table.demonMessage = undefined;
			table.state = TABLE_DISPLAY;

			switch (table.currentMove.type) {
				case BOARD:
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					table.message = `The board reveals that ${targetTablePlayer.name} ${is ? "IS" : "IS NOT"} possessed`;
					broadcastMessage(table, `The board reveals that <c>${targetTablePlayer.name}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
					break;
				case ROD:
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					table.message = `${table.currentMove.playerName} is interpreting the results of the divining rod`;

					var message = `${targetTablePlayer.name} ${is ? "IS" : "IS NOT"} possessed.`;
					var player = getPlayerBySessionId(table.currentMove.playerId);
					player.socket.emit("pop up", message);
					break;
				case EXORCISM: 
					var is = game.possessedPlayers.includes(targetTablePlayer.name);
					if (game.doInterfere) is = !is;
					table.message = `It appears that ${targetTablePlayer.name} ${is ? "IS" : "IS NOT"} possessed`;
					broadcastMessage(table, `It appears that <c>${targetTablePlayer.name}</c> <b>${is ? "IS" : "IS NOT"}</b> possessed`);
					if (!game.doInterfere) possessPlayer(table, table.currentMove.targetName, false);

					targetTablePlayer.isExorcised = true;
					if (!targetTablePlayer.move) targetTablePlayer.move = {type: PASS};
					var targetPlayer = getPlayerBySessionId(targetTablePlayer.sessionId);
					targetPlayer.socket.emit("pop up", "You are unconscious until tomorrow, do not speak!");
					break;
			}
			autoAdvanceRound(table, SHOW_RESULT_DISPLAY_SEC);
			break;
		case TABLE_DISPLAY:
			handleRoundEnd(table);
			break;
		case TABLE_END:
			clearMoves(table);
			table.state = TABLE_LOBBY;
			table.msg = WAIT_MSG;
			// Reset some state.
			for (var tablePlayer of table.players) {
				tablePlayer.isDamned = false;
				tablePlayer.isExorcised = false;
			}
			break;
	}
	updateTable(table);	
}

function autoAdvanceRound(table, delay) {
	table.timerId = Number(setTimeout(advanceRound.bind(null, table), 1000 * (delay + 1)));
}

function timeoutRound(table) {
	table.timeout = true;
	if (table.state === TABLE_DAY) {
		table.message = "The sun is settings, night is falling...";
		table.state = TABLE_DISPLAY;
		autoAdvanceRound(table, ROUND_OVER_DISPLAY_SEC);
		updateTable(table);
	}
}

function handleRoundEnd(table) {
	clearVotes(table);
	advanceCurrentPlayer(table);
	var game = getGameByCode(table.code);
	if (game.possessedPlayers.length === 0) {
		table.state = TABLE_END;
		table.message = `The demon's presence has been purged! Sadly it took some of us with it...`;
		var winners = [];
		table.demonMessage = undefined;
		for (var tablePlayer of table.players) {
			if (tablePlayer.isDemon || game.damnedPlayers.includes(tablePlayer.name)) {
				tablePlayer.isDamned = true;
				tablePlayer.isDemon = false;
			} else {
				winners.push(tablePlayer.name);
			}
		}
		broadcastMessage(table, `The virtuous win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
		table.demonId = undefined;
		clearMoves(table);
		clearTimer(table);
		clearRoundTimer(table);
	} else if (isStillDay(table)) {
		table.state = TABLE_DAY;
		table.message = DAY_PLAYER_MSG;
		table.currentMove = undefined;
		if (table.settings.turnOrder) {
			table.message = `It is ${currentPlayer(table).name}'s turn to select a tool`;
			broadcastMessage(table, table.message);
			table.timers[MOVE_TIMER] = getTimerValue(table.settings.moveTime);
			autoAdvanceRound(table, table.settings.moveTime);
		}
	} else if (game.possessedPlayers.length >= (table.players.length - 1) / 2) {
		table.state = TABLE_END;
		table.message = `The demon has possessed ${game.possessedPlayers.length} players! You have fallen to darkness!`;
		table.demonMessage = undefined;
		var winners = [];
		for (var tablePlayer of table.players) {
			if (tablePlayer.isDemon || game.possessedPlayers.includes(tablePlayer.name)) {
				tablePlayer.isDamned = true;
				tablePlayer.isDemon = false;
				winners.push(tablePlayer.name);
			}
		}
		broadcastMessage(table, `The damned win: ${winners.map(p => `<c>${p}</c>`).join(", ")}!`);
		table.demonId = undefined;
		clearMoves(table);
		clearTimer(table);
		clearRoundTimer(table);
	} else {
		var game = getGameByCode(table.code);
		table.state = TABLE_NIGHT;
		table.message = `There ${game.anyInterfere ? "WAS" : "WAS NOT"} interference during the round.`;
		broadcastMessage(table, `There <b>${game.anyInterfere ? "WAS" : "WAS NOT"}</b> interference during the round.`);
		table.demonMessage = `${NIGHT_DEMON_MSG}`;

		table.currentPlayer = undefined;
		game.anyInterfere = false;
		clearMoves(table);
		clearTimer(table);
		clearRoundTimer(table);
	}
}

function isStillDay(table) {
	if (table.settings.turnOrder) {
		if (table.currentPlayer === table.startPlayer) return false;
	} else {
		if (table.timeout) return false;
	}

	// Check if any player can make a move.
	var resourceCount = 0;
	for (var item of ITEMS) {
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

function handleNewGame(table) {
	if (table.players.length < table.settings.minPlayers) {
		emitErrorToTable(table, `Cannot being game with less than ${table.settings.minPlayers} players!`);
		return false;
	}
	// Game holds secret information.
	var game = getGameByCode(table.code);
	if (!game) {
		game = {
			tableCode: table.code,
		};
		games.push(game);
	}
	game.interfereUses = {};
	game.interfereUses[WATER] = 0;
	game.interfereUses[BOARD] = 1;
	game.interfereUses[ROD] = 1;
	game.interfereUses[EXORCISM] = 1;

	game.possessedPlayers = [];

	// Clear chat logs
	chatLogs[table.code] = [];
	chatLogs[table.code][GENERAL] = [];
	clearChats(table);

	// Select demon
	var index = Math.floor(Math.random() * table.players.length);
	var demon = table.players[index];
	demon.isDemon = true;
	chatLogs[table.code][demon.name] = [];
	table.demonId = demon.sessionId;
	var demonPlayer = getPlayerBySessionId(table.demonId);
	demonPlayer.socket.emit("pop up", "You are the demon!");
	demonPlayer.socket.emit("update interfere", game.interfereUses);
	broadcastMessage(table, `<c>${demon.name}</c> is the demon!`);

	// Reset resources
	table.resources = {};
	table.resources[WATER] = -1;

	// Reset timers
	table.timers = {};
	table.timers[ROUND_TIMER] = false;
	table.timers[MOVE_TIMER] = false;
	table.timers[DEMON_TIMER] = false;

	// Set turn order
	if (table.settings.turnOrder) table.startPlayer = Math.floor(Math.random() * table.players.length);

	return true;
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
	table.startPlayer = nextPlayer(table, table.startPlayer);
}

function nextPlayer(table, index) {
	index = (index + 1).mod(table.players.length);
	if (table.players[index].sessionId === table.demonId) index = (index + 1).mod(table.players.length);
	return index;
}

function handleNewRound(table) {
	if (table.settings.turnOrder) {
		advanceStartPlayer(table);
		table.currentPlayer = table.startPlayer;
	}

	var game = getGameByCode(table.code);
	game.damnedPlayers = [];
	// Clear exorcism
	for (var player of table.players) {
		player.isExorcised = false;
	}
	// Update resources
	table.resources = {
		BOARD: 1,
		WATER: Math.floor(Math.min(table.players.length / 3, table.resources[WATER] + 1)),
		ROD: 1,
		EXORCISM: 1,
	};
}

function possessPlayer(table, targetName, doPossess) {
	var game = getGameByCode(table.code);
	var demonPlayer = getPlayerBySessionId(table.demonId);
	var demonTablePlayer = getTablePlayerBySessionId(table.demonId, table);
	var tablePlayer = getTablePlayerByName(targetName, table);
	var targetPlayer = getPlayerBySessionId(tablePlayer.sessionId);
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
		removeByValue(game.possessedPlayers, tablePlayer.name);
		targetPlayer.socket.emit("clear chat", "demon-chat");
		chatLogs[table.code][tablePlayer.name] = [];
		sendDemonMessage(table, `${tablePlayer.name} has been freed!`, false, demonTablePlayer.name);
		game.damnedPlayers.push(tablePlayer.name);
	}
	targetPlayer.socket.emit("possession", doPossess);
	// Update demon on possessed players.
	demonPlayer.socket.emit("possessed players", game.possessedPlayers);
	return true;
}

function clearMoves(table) {
	for (var tablePlayer of table.players) {
		tablePlayer.move = undefined;
	}
	table.currentMove = undefined;
}

function clearVotes(table) {
	for (var tablePlayer of table.players) {
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) continue;
		tablePlayer.voted = false;
		tablePlayer.vote = undefined;
		player.vote = undefined;
	}
}

function tallyVotes(table, makePublic) {
	var tally = {
		yes: [],
		no: [],
		abstain: [],
	};
	for (var tablePlayer of table.players) {
		if (tablePlayer.isDemon) continue;
		var player = getPlayerBySessionId(tablePlayer.sessionId);
		if (!player) continue;

		// Exorcised players should not be able to vote, but just in case.
		if (tablePlayer.isExorcised) {
			player.vote = undefined;
			tablePlayer.voted = false;
		}
		// Tally vote.
		if (!tablePlayer.voted) {
			tally.abstain.push(tablePlayer.name)
		} else if (player.vote) {
			tally.yes.push(tablePlayer.name);
		} else {
			tally.no.push(tablePlayer.name);
		}
		// Show the vote at the end of the round.
		if (makePublic) {
			tablePlayer.vote = player.vote;
		}
	}
	return tally;
}

///// Utility functions \\\\\

function checkName(socket, name) {
	if (name.match("^[\\d\\w]+$")) return true;
	socket.emit("server error", `Invalid name: '${name}', alphanumeric only!`);
	return false;
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

function getAvailableColor(table) {
	for (var color of PLAYER_COLORS) {
		if (table.playerColors.includes(color)) continue;
		return color;
	}
}

function isTableOwner(playerId, table) {
	console.log(`${playerId}`);
	console.log(`${table.players[0].socketId}`);
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	return table && table.players && table.players.length > 0 && table.players[0].socketId === playerId;
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

function handleNewConnection(socket, sessionId) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());

	console.log("NEW CONNECTION");
	console.log(cookie.parse(socket.request.headers.cookie)["connect.sid"]);

	var sessionId = DEBUG ? `${socket.id} session` : cookie.parse(socket.request.headers.cookie)["connect.sid"];
	//console.log("SESSION ID: " + sessionId); 
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
		removeByValue(inactive, player);
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
				// Send chat
				console.log("UPDATING TABLE LOG");
				for (var l of chatLogs[table.code][GENERAL]) {
					socket.emit("chat msg", l.msg, l.sender);
				}
				// Send demon chat if it exists
				console.log("UPDATING DEMON LOG");
				if (chatLogs[table.code][tablePlayer.name]) {
					for (var l of chatLogs[table.code][tablePlayer.name]) {
						socket.emit("demon msg", l.msg, l.player);
					}
				}
				var game = getGameByCode(table.code);
				if (game && game.possessedPlayers.includes(tablePlayer.name)) player.socket.emit("possession", true);
				if (tablePlayer.isDemon) {
					player.socket.emit("possessed players", game.possessedPlayers);
					player.socket.emit("update interfere", game.interfereUses);
				}
			} else {
				player.tableCode = undefined;
				clearTable(socket);
			}
		} else {
			clearTable(socket);
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
		clearTable(socket);
	}
}

function clearTable(socket) {
	socket.emit("update table", false);
}

function playerDisconnected(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var player = getPlayerBySocketId(socket.id);
	removeByValue(players, player);
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
		player.socket = undefined;
		inactive.push(player);
		console.log(`PUSHING PLAYER WITH SESSION ID ${player.sessionId} TO INACTIVE`);
	}
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
	if (table && table.players) {
		for (var player of table.players) {
			if (player.name === name) {
				return player
			}
		}
	}
	return false;
}

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
	for (var player of players) {
		if (player.sessionId === sessionId) return player;
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
	for (var table of tables) {
		for (var tablePlayer of table.players) {
			if (tablePlayer.socketId === socketId) {
				return table;
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