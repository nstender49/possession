// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
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

// Move images
const ITEM_IMAGES = [];
ITEM_IMAGES[WATER] = new PreLoadedImage("/images/water.png");
ITEM_IMAGES[BOARD] = new PreLoadedImage("/images/planchette.png");
ITEM_IMAGES[ROD] = new PreLoadedImage("/images/rod.png");
ITEM_IMAGES[EXORCISM] = new PreLoadedImage("/images/cross.png");
ITEM_IMAGES[PASS] = new PreLoadedImage("/images/pass.png");

// Sound 
const SOUND_ON_IMG = new PreLoadedImage("/images/sound_on.png");
const SOUND_OFF_IMG = new PreLoadedImage("/images/sound_off.png");
const TABLE_IMAGE = new PreLoadedImage("/images/table.png");
const FAIL_X_IMAGE = new PreLoadedImage("/images/fail_x.png");
const VOTED_IMAGE = new PreLoadedImage("/images/voted.png");
const YES_VOTE_IMAGE = new PreLoadedImage("/images/vote_yes.png");
const NO_VOTE_IMAGE = new PreLoadedImage("/images/vote_no.png");
const PENTAGRAM_IMAGE = new PreLoadedImage("/images/pentagram.png");

// Player images
const PLAYER_IMAGES = [];
for (var i = 0; i < 12; i++) {
	PLAYER_IMAGES[i] = new PreLoadedImage(`/images/avatars/${i}.png`);
}

// Debug settings
var DEBUG = false;
var logFull = true;

// Config settings received from server.
var newTableSettings = {
	minPlayers: 6,
	maxPlayers: 12,
};

// Game settings
var soundEnabled = false;

// Game state
var socket = io();
var labels = [];
var buttons = [];
var drawGroups = [];
var sounds = [];

// Game state
var gameState, theTable, thePlayer, thePlayerIsPossessed;
// Demon state
var possessedPlayers, interfereUses;
// Interface variables 
var selectedPlayer, popupMessage;

//////////  Socket Events  \\\\\\\\\\

// Main update function, table contains most of the important information.
socket.on("update table", function(table) {
	updateTable(table);
});

// Update the hand for a specific player.
// Hands are updated separately from table to make showing only certain players hands easy.
socket.on("update hand", function(name, hand, clear) {
	if (clear) { hands = []; }
	hands[name] = hand;
});

// Triggers countdown sound, to keep it sync with the server.
socket.on("play countdown", function() {
	sounds["count"].play();
});

// Emit an error to the player from the server.
socket.on("server error", function(msg) {
	raiseError(msg);
});

socket.on("chat msg", function(msg, sender) {
	addMessage("player-chat", msg, sender);
});

socket.on("clear chat", function(chat) {
	clearChat(chat);
});

function clearChat(chat) {
	document.getElementById(chat).innerHTML = "";
}

socket.on("demon msg", function(msg, player) {
	addMessage("demon-chat", msg, player);
});

socket.on("pop up", function(msg) {
	popupMessage = msg;
});

socket.on("possession", function(isPossessed) {
	thePlayerIsPossessed = isPossessed
});

socket.on("possessed players", function(players) {
	possessedPlayers = players;
	if (!possessedPlayers.includes(selectedPlayer)) {
		selectedPlayer = possessedPlayers[0];
	}
});

socket.on("update interfere", function(uses) {
	interfereUses = uses;
	labels["interfere uses"].text = `Interfere uses: ${uses}`;
});


function addMessage(chat, msg, player) {
	var messages = document.getElementById(chat);
	var item = document.createElement("li");
	var content = msg;
	if (player === thePlayer.name) {
		item.style.textAlign = "right";
	} else if (chat === "player-chat" && player) {
		content = `${player} : ${msg}`;
	} else if (chat === "demon-chat" && thePlayer.isDemon && player) {
		content = `${player} => ${msg}`
	} else if (!player) {
		content = `<< ${msg} >>`;
	}
	item.textContent = content;
	messages.appendChild(item);
	item.scrollIntoView();
}

// Server calls on connection to provide settings from server.
socket.on("init settings", function(settings) {
	labels["version"].text = settings.code_version ? `v${settings.code_version}` : "local";
	DEBUG = settings.DEBUG;
	if (DEBUG) {
		newTableSettings.minPlayers = 3;
	}
	handleResize();
});

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Functions  \\\\\\\\\\

///// Game state \\\\\

function initLabels() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Main menu
	labels["title"] = new Label({x: 0.5, y: 0.4}, "POSSESSION", 80);
	buttons["make table"] = new Button({x: 0.5, y: 0.6}, "Make Table", 80, makeTable);
	buttons["join table"] = new Button({x: 0.5, y: 0.85}, " Join Table ", 80, joinTable);
	drawGroups["main menu"] = new DrawGroup([
		labels["title"],
		buttons["make table"],
		buttons["join table"],
	]);

	// Table
	labels["table_img"] = new ImageLabel({x: 0.3, y: 0.5}, 0.4, false, TABLE_IMAGE, true, false);
	labels["message"] = new Label({x: 0.3, y: 0.5}, "", 30);
	buttons["leave table"] = new Button({x: 0.3, y: 0.6}, "Leave", 30, leaveTable);
	buttons["begin game"] = new Button({x: 0.3, y: 0.4}, "Begin", 30, doMove.bind(null, BEGIN));
	
	// Items
	buttons[WATER] = new ImageButton({x: 0.24, y: 0.35}, false, 0.18, true, false, ITEM_IMAGES[WATER], doMove.bind(null, WATER), false, false, "black");
	labels["water_count"] = new Label({x: 0.18, y: 0.37}, "", 20);
	buttons[BOARD] = new ImageButton({x: 0.4, y: 0.35}, false, 0.18, true, false, ITEM_IMAGES[BOARD], doMove.bind(null, BOARD));
	labels["board_count"] = new Label({x: 0.34, y: 0.37}, "", 20);
	buttons[ROD] = new ImageButton({x: 0.24, y: 0.65}, false, 0.18, true, false, ITEM_IMAGES[ROD], doMove.bind(null, ROD));
	labels["rod_count"] = new Label({x: 0.18, y: 0.67}, "", 20);
	buttons[EXORCISM] = new ImageButton({x: 0.4, y: 0.65}, false, 0.18, true, false, ITEM_IMAGES[EXORCISM], doMove.bind(null, EXORCISM));
	labels["exorcism_count"] = new Label({x: 0.34, y: 0.67}, "", 20);
	buttons[PASS] = new Button({x: 0.3, y: 0.55}, "Pass", 15, doMove.bind(null, PASS));
	drawGroups["items"] = new DrawGroup([
		buttons[WATER],
		buttons[BOARD],
		buttons[ROD],
		buttons[EXORCISM],
		labels["water_count"],
		labels["board_count"],
		labels["rod_count"],
		labels["exorcism_count"],
		buttons[PASS],
	]);

	// Voting phase
	labels[WATER] = new ImageLabel({x: 0.3, y: 0.35}, false, 0.25, ITEM_IMAGES[WATER], true);
	labels[BOARD] = new ImageLabel({x: 0.3, y: 0.35}, false, 0.25, ITEM_IMAGES[BOARD], true);
	labels[ROD] = new ImageLabel({x: 0.3, y: 0.35}, false, 0.25, ITEM_IMAGES[ROD], true);
	labels[EXORCISM] = new ImageLabel({x: 0.3, y: 0.35}, false, 0.25, ITEM_IMAGES[EXORCISM], true);
	buttons["vote yes"] = new Button({x: 0.25, y: 0.6}, "Yes", 20, doVote.bind(null, true), undefined, true);
	buttons["vote no"] = new Button({x: 0.35, y: 0.6}, "No", 20, doVote.bind(null, false), undefined, true);
	drawGroups["voting"] = new DrawGroup([
		buttons["vote yes"],
		buttons["vote no"],
	]);

	// Chat
	buttons["submit chat"] = new Button({x: 0.934, y: 0.681}, "↵", 15, submitChat);
	buttons["clear popup"] = new Button({x: 0.3, y: 0.53}, "OK", 20, clearPopUp);
	
	// Demon / interfere
	labels["interfere uses"] = new Label({x: 0.53, y: 0.95}, "Interfere uses: 0", 15, true);
	buttons["interfere yes"] = new Button({x: 0.25, y: 0.6}, "Yes", 20, doInterfere.bind(null, true));
	buttons["interfere no"] = new Button({x: 0.35, y: 0.6}, "No", 20, doInterfere.bind(null, false));
	drawGroups["interfere"] = new DrawGroup([
		buttons["interfere yes"],
		buttons["interfere no"],
	]);

	// Game settings (bottom bar)
	labels["table"] = new Label({x: 0.01, y: 0.99}, "", 15, "left");
	labels["error msg"] = new Label({x: 0.5, y: 0.98}, "", 20);
	buttons["sound"] = new ImageButton({x: 0.91, y: 0.97}, 0.02, false, false, false, SOUND_ON_IMG, toggleSound.bind(null, true), SOUND_OFF_IMG, toggleSound.bind(null, false));
	labels["version"] = new Label({x: 0.99, y: 0.99}, "", 15, "right", "monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		labels["table"],
		labels["error msg"],
		buttons["sound"],
		labels["version"],
	]);

	// Sounds
	sounds["count"] = new sound("/sounds/racestart.wav");
}

function updateSettings() {
	socket.emit("update settings", theTable.settings);
}

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var button of Object.values(buttons)) {
		button.disable();
	}

	buttons["sound"].enable();

	if (state === MAIN_MENU) {
		showInputs(["player-name", "game-code"]);
	} else {
		showInputs(["player-chat", "chat-input", "demon-chat"]);
		buttons["submit chat"].enable();
	}

	switch(state) {
		case MAIN_MENU:
			buttons["make table"].enable();
			buttons["join table"].enable();
			showInputs(["player-name", "game-code"]);
			break;
		case TABLE_LOBBY:
			thePlayerIsPossessed = false;
			possessedPlayers = [];
			buttons["leave table"].enable();
			break;
		case TABLE_NIGHT:
			break;
		case TABLE_DAY:
			if (thePlayer.isDemon) {
				drawGroups["items"].show();
			} else {
				drawGroups["items"].enable();
			}
			break;
		case TABLE_SECONDING: 
			if (!(thePlayer.isDemon || theTable.currentMove.playerId === thePlayer.sessionId)) {
				drawGroups["voting"].enable();
			}
			break;
		case TABLE_VOTING:
			if (!thePlayer.isDemon) {
				drawGroups["voting"].enable();
			}
			break;
		case TABLE_INTERFERE:
			if (thePlayer.isDemon) {
				drawGroups["interfere"].enable();
			}
	}
	gameState = state;
}

function showInputs(inputs) {
	for (var e of ELEM_CONFIGS) {
		document.getElementById(e.name).style.display = inputs.includes(e.name) ? "block" : "none";
	}
}

function toggleSound(enable) {
	if (!enable) {
		for (var sound of sounds) {
			sound.stop();
		}
	}
	soundEnabled = enable;
}

///// Game logic \\\\\

function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].socketId === socket.id;
}

function doMove(move) {
	socket.emit("do move", {type: move});
}

function doVote(vote) {
	buttons[vote ? "vote no" : "vote yes"].clicked = false;
	socket.emit("do move", {type: gameState === TABLE_SECONDING ? SECOND : VOTE, vote: vote});
}

function doInterfere(vote) {
	drawGroups["interfere"].disable();
	socket.emit("do move", {type: INTERFERE, vote: vote});
}

function selectPlayer(playerId, name) {
	if (thePlayer.isDemon) {
		if (gameState === TABLE_NIGHT) {
			socket.emit("do move", {type: SELECT, targetId: playerId});
		} else {
			if (possessedPlayers.includes(name)) {
				selectedPlayer = name;
			}
		}
	} else {
		if (gameState === TABLE_SELECT) {
			socket.emit("do move", {type: SELECT, targetId: playerId});
		}
	}
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

function cycleActivePlayer(forward) {
	if (thePlayer.isDemon) {
		var index = possessedPlayers.indexOf(selectedPlayer);
		index = (index + (forward ? 1 : -1)).mod(possessedPlayers.length);
		selectedPlayer = possessedPlayers[index];
	}
}

function getSelectedPlayer() {
	if (selectedPlayer) {
		for (var player of theTable.players) {
			if (player.name === selectedPlayer) {
				return player;
			}
		}
	}
}

function clearPopUp() {
	popupMessage = undefined;
}

///// Client-server functions \\\\\

function submitChat() {
	var input = document.getElementById("chat-input");
	if (input.value) {
		socket.emit("chat msg", input.value, thePlayer.isDemon ? selectedPlayer : false);
		input.value = "";
	}
}

function makeTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (socket.connected) {
		var name = document.getElementById("player-name").value;
		// TODO: make settings and send them here.
		if (name) {
			socket.emit("make table", name, newTableSettings);
		} else {
			raiseError("Must provide name to make table!");
		}
	} else {
		raiseError("Waiting for server connection...");
	}
}

function joinTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (socket.connected) {
		var name = document.getElementById("player-name").value;
		var code = document.getElementById("game-code").value;
		if (name && code) {
			socket.emit("join table", code, name);
		} else {
			raiseError("Must provide name and table code to join table!");
		}
	} else { 
		raiseError("Waiting for server connection...");
	}
}

function updateTable(table) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (table) {
		// Clear existing state in chat.
		if (!theTable) {
			clearChat("player-chat");
			clearChat("demon-chat");
		}
		for (var player of table.players) {
			// Store local player in global var
			if (player.socketId === socket.id) {
				thePlayer = player;
			}
			// Make button avatars for players if they don't exist
			if (!buttons[player.name]) {
				buttons[player.name] = new ImageButton({x: 0, y: 0}, 0, false, true, true, PLAYER_IMAGES[player.avatarId], selectPlayer.bind(null, player.sessionId, player.name));
			}
		}
		var change = !theTable || gameState != table.state;
		theTable = table;
		if (change) {
			changeState(table.state);
		}
		labels["message"].text = (thePlayer.isDemon && table.demonMessage) ? table.demonMessage : table.message;
		labels["table"].text = `Table ${table.code}`;
	} else {
		theTable = false;
		popupMessage = undefined;
		changeState(MAIN_MENU);
	}
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
}

function handleServerDisconnect() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var msg = "Server disconnected!";
	raiseError(msg);
	theTable = false;
	popupMessage = undefined;
	changeState(MAIN_MENU);
}

function raiseError(msg) {
	labels["error msg"].text = msg;
	labels["error msg"].opacity = 100;
	labels["error msg"].visible = true;
	setTimeout(fadeLabel.bind(null, "error msg", true), ERROR_DURATION_SEC * 10);
}

function fadeLabel(label, start) {
	if (start) {
		labels[label].opacity = 1;
		labels[label].visible = true;
	} else {
		labels[label].opacity -= 0.01;
	}
	if (labels[label].opacity > 0) {
		setTimeout(fadeLabel.bind(null, "error msg", false), ERROR_DURATION_SEC * 10);
	} else {
		labels[label].visible = false;
	}
}