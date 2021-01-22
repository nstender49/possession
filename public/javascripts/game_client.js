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
const TABLE_END = "table game over";

const PLAYER_COLORS = [
	"#fbb7c5", "#8dd304", "#0089cc", "#98178e", "#ed6e01",  
	"#a37e30", "#ed2c34", "#144c2a", "#0046b6", "#512246", "#fdc918", 
	"#4c270c", "#000000", "#ffffff"
];

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
const FINISH = "FINISH";

// Timers
ROUND_TIMER = "round timer";
MOVE_TIMER = "move timer";
DEMON_TIMER = "demon timer";

// Sound 
SOUND_ON = "sound_on";
SOUND_OFF = "sound_off";
TABLE = "table";
FAIL_X = "fail_x";
VOTED = "voted";
YES_VOTE = "vote_yes";
NO_VOTE = "vote_no";
PENTAGRAM  = "pentagram";
NAMEPLATE = "nameplate";
HOURGLASS = "hourgalss";

const IMAGES = [];
IMAGES[WATER] = new PreLoadedImage("/images/water.png");
IMAGES[BOARD] = new PreLoadedImage("/images/planchette.png");
IMAGES[ROD] = new PreLoadedImage("/images/rod.png");
IMAGES[EXORCISM] = new PreLoadedImage("/images/cross.png");
IMAGES[PASS] = new PreLoadedImage("/images/pass.png");

IMAGES[TABLE] = new PreLoadedImage("/images/table.png");
IMAGES[FAIL_X] = new PreLoadedImage("/images/fail_x.png");
IMAGES[VOTED] = new PreLoadedImage("/images/voted.png");
IMAGES[YES_VOTE] = new PreLoadedImage("/images/vote_yes.png");
IMAGES[NO_VOTE] = new PreLoadedImage("/images/vote_no.png");
IMAGES[PENTAGRAM] = new PreLoadedImage("/images/pentagram.png");
IMAGES[NAMEPLATE] = new PreLoadedImage("/images/nameplate.png");
IMAGES[HOURGLASS] = new PreLoadedImage("/images/hourglass.png");

// Player images
const AVATAR_COUNT = 50;
const PLAYER_IMAGES = [];

// Debug settings
var DEBUG = false;
var logFull = true;

// Config settings received from server.
var newTableSettings = {
	// Table settings
	minPlayers: 5,
	maxPlayers: 12, 
	// Time limits
	/*
	roundTime: 300,
	secondTime: 10,
	selectTime: 15,
	voteTime: 30,
	interfereTime: 10,
	*/
	roundTime: 600,
	secondTime: 20,
	selectTime: 30,
	voteTime: 60,
	interfereTime: 10,
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
var possessedPlayers, interfereUses, selectedPlayer, chatIsDemon;
// Display
var timers = [];
// Overlay
var overlay, popupMessage, howtoPage;
const HOW_TO_PAGES = 2;
const OVERLAY_POPUP = "pop up";
const OVERLAY_AVATAR = "avatar";
const OVERLAY_HOWTO = "how to";

//////////  Socket Events  \\\\\\\\\\

// Main update function, table contains most of the important information.
socket.on("update table", function(table) {
	updateTable(table);
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

socket.on("demon msg", function(msg, player) {
	addMessage("demon-chat", msg, player);
});

socket.on("pop up", function(msg) {
	popupMessage = msg;
	enableOverlay(OVERLAY_POPUP);
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
	labels["interfere uses"].setData(uses);
});

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
	labels["title"] = new Label(0.5, 0.4, "POSSESSION", 80);
	buttons["make table"] = new Button(0.5, 0.6, "Make Table", 80, makeTable);
	buttons["join table"] = new Button(0.5, 0.85, " Join Table ", 80, joinTable);
	drawGroups["main menu"] = new DrawGroup([
		labels["title"],
		buttons["make table"],
		buttons["join table"],
	]);

	// Table
	labels["table_img"] = new ImageLabel({x: 0.3, y: 0.5}, 0.4, false, IMAGES[TABLE]).setCenter(true);
	labels["message"] = new Label(0.3, 0.5, "", 20);
	buttons["leave table"] = new Button(0.3, 0.6, "Leave", 30, leaveTable);
	buttons["begin game"] = new Button(0.3, 0.4, "Begin", 30, doMove.bind(null, BEGIN));
	buttons["change avatar"] = new Button(0.3, 0.7, "Change Avatar", 20, enableOverlay.bind(null, OVERLAY_AVATAR));
	buttons["finish game"] = new Button(0.3, 0.4, "Finish", 30, doMove.bind(null, FINISH));

	// Timers
	labels["move timer hourglass"] = new ImageLabel({x: 0.28, y: 0.755}, 0.015, false, IMAGES[HOURGLASS]);
	labels[MOVE_TIMER] = new Label(0.32, 0.79, "{}", 20);
	drawGroups[MOVE_TIMER] = new DrawGroup([labels["move timer hourglass"], labels[MOVE_TIMER]]);
	labels["round timer title"] = new Label(0.26, 0.235, "Round", 20);
	labels["round timer hourglass"] = new ImageLabel({x: 0.295, y: 0.2}, 0.015, false, IMAGES[HOURGLASS]);
	labels[ROUND_TIMER] = new Label(0.375, 0.235, "{}", 20).setAlign("right");
	drawGroups[ROUND_TIMER] = new DrawGroup([labels["round timer title"], labels["round timer hourglass"], labels[ROUND_TIMER]]);
	drawGroups["timers"] = new DrawGroup([drawGroups[MOVE_TIMER], drawGroups[ROUND_TIMER]]);

	// Items
	buttons[WATER] = new ImageButton({x: 0.24, y: 0.35}, false, 0.18, true, false, IMAGES[WATER], doMove.bind(null, WATER), false, false, "black");
	labels["water_count"] = new Label(0.18, 0.37, "{} x", 20);
	buttons[BOARD] = new ImageButton({x: 0.4, y: 0.35}, false, 0.18, true, false, IMAGES[BOARD], doMove.bind(null, BOARD));
	labels["board_count"] = new Label(0.34, 0.37, "{} x", 20);
	buttons[ROD] = new ImageButton({x: 0.24, y: 0.65}, false, 0.18, true, false, IMAGES[ROD], doMove.bind(null, ROD));
	labels["rod_count"] = new Label(0.18, 0.67,"{} x", 20);
	buttons[EXORCISM] = new ImageButton({x: 0.4, y: 0.65}, false, 0.18, true, false, IMAGES[EXORCISM], doMove.bind(null, EXORCISM));
	labels["exorcism_count"] = new Label(0.34, 0.67, "{} x", 20);
	buttons[PASS] = new Button(0.3, 0.55, "Pass", 15, doMove.bind(null, PASS));
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
	labels[WATER] = new ImageLabel({x: 0.3, y: 0.37}, false, 0.18, IMAGES[WATER]).setCenter(true);
	labels[BOARD] = new ImageLabel({x: 0.3, y: 0.37}, false, 0.18, IMAGES[BOARD]).setCenter(true);
	labels[ROD] = new ImageLabel({x: 0.3, y: 0.37}, false, 0.18, IMAGES[ROD]).setCenter(true);
	labels[EXORCISM] = new ImageLabel({x: 0.3, y: 0.37}, false, 0.18, IMAGES[EXORCISM]).setCenter(true);
	buttons["vote yes"] = new Button(0.25, 0.6, "Yes", 20, doVote.bind(null, true)).setSticky(true);
	buttons["vote no"] = new Button(0.35, 0.6, "No", 20, doVote.bind(null, false)).setSticky(true);
	drawGroups["voting"] = new DrawGroup([
		buttons["vote yes"],
		buttons["vote no"],
	]);

	// Chat
	buttons["submit chat"] = new Button(0.935, 0.69, "↵", 15, submitChat);
	
	// Demon / interfere
	labels["interfere uses"] = new Label(0.53, 0.95, "Interfere uses: {}", 15).setData(0);
	buttons["interfere yes"] = new Button(0.25, 0.6, "Yes", 20, doInterfere.bind(null, true));
	buttons["interfere no"] = new Button(0.35, 0.6, "No", 20, doInterfere.bind(null, false));
	drawGroups["interfere"] = new DrawGroup([
		buttons["interfere yes"],
		buttons["interfere no"],
	]);

	// Game settings (bottom bar)
	labels["table"] = new Label(0.01, 0.99, "Table {}", 15).setAlign("left").setData("????");
	labels["error msg"] = new Label(0.5, 0.98, "", 20);
	labels["version"] = new Label(0.99, 0.99, "", 15).setAlign("right").setFont("monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		labels["table"],
		labels["error msg"],
		// buttons["sound"],
		labels["version"],
	]);

	// Pop up
	buttons["clear popup"] = new Button(0.3, 0.53, "OK", 20, clearOverlay).setOverlay();

	// How to play
	buttons["howto"] = new Button(0.02, 0.93, "How To Play", 12, enableOverlay.bind(null, OVERLAY_HOWTO)).setAlign("left");
	buttons["clear howto"] = new Button(0.5, 0.91, "Ok", 20, clearOverlay).setOverlay();
	buttons["howto >"] = new Button(0.9, 0.91, ">", 20, pageHowTo.bind(null, 1)).setOverlay();
	buttons["howto <"] = new Button(0.1, 0.91, "<", 20, pageHowTo.bind(null, -1)).setOverlay();
	drawGroups["howto"] = new DrawGroup([
		buttons["clear howto"],
		buttons["howto >"],
		buttons["howto <"]
	]);

	// Avatar selection
	buttons["clear avatar"] = new Button(0.955, 0.9, "✓", 40, clearOverlay).setOverlay();
	drawGroups["avatar selection"] = new DrawGroup([]);
	for (var i = 0; i < AVATAR_COUNT; i++) {
		buttons[`avatar ${i}`] = new ImageButton({x: 0, y: 0}, 0, false, false, true, PLAYER_IMAGES[i], changeAvatar.bind(null, i)).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`avatar ${i}`]);
	}
	for (var color of PLAYER_COLORS) {
		buttons[`color ${color}`] = new ShapeButton({x: 0, y: 0}, 0, 0, false, true, color, changeColor.bind(null, color)).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`color ${color}`]);
	}

	// Sounds
	// sounds["count"] = new sound("/sounds/racestart.wav");
}

function enableInputs() {
	if (!theTable || theTable.state === MAIN_MENU) {
		toggleInputs(["player-name", "game-code"]);
	} else {
		toggleInputs(["player-chat", "chat-input", "demon-chat"]);
		buttons["submit chat"].enable();
	}
}

function toggleInputs(inputs = []) {
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

function clearChat(chat) {
	document.getElementById(chat).innerHTML = "";
}

function formatTimer(time) {
	var diff = Math.floor((time - Date.now()) / 1000);
	if (diff < 60) return `${diff}s`;
	return `${Math.floor(diff / 60)}m${(diff % 60).toString().padStart(2, "0")}s`;
}

function setTimer(timer) {
	var label = timer === ROUND_TIMER ? ROUND_TIMER : MOVE_TIMER;
	if (timers[label]) clearTimeout(timers[label]);
	if (!theTable || theTable.timers[timer] === undefined || Date.now() > theTable.timers[timer]) {
		drawGroups[label].disable();
	} else {
		drawGroups[label].show();
		labels[label].setData(formatTimer(theTable.timers[timer]));
		timers[label] = Number(setTimeout(setTimer.bind(null, timer), 1000));
	}
}

///// Game logic \\\\\

function changeState(state) {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (state === gameState) {
		return;
	}
	for (var button of Object.values(buttons)) {
		button.disable();
	}

	buttons["howto"].enable();

	enableInputs();

	switch(state) {
		case INIT:
			overlay = undefined;
			howtoPage = 0;
			drawGroups["timers"].disable();
			break;
		case MAIN_MENU:
			overlay = undefined;
			buttons["make table"].enable();
			buttons["join table"].enable();
			break;
		case TABLE_LOBBY:
			overlay = undefined;
			thePlayerIsPossessed = false;
			possessedPlayers = [];
			buttons["leave table"].enable();
			buttons["change avatar"].enable();
			break;
		case TABLE_NIGHT:
			if (overlay !== OVERLAY_POPUP) overlay = undefined;
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
			if (thePlayer.isDemon && interfereUses > 0) {
				drawGroups["interfere"].enable();
			}
	}
	gameState = state;
}

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

function setChatHeight() {
	if (!thePlayer || thePlayer.isDemon === chatIsDemon) return;
	if (thePlayer.isDemon) {
		for (var config of ELEM_CONFIGS) {
			if (config.name === "player-chat") {
				config.h = 0.25;
			}
			if (config.name === "demon-chat") {
				config.h = 0.6;
				config.y = 0.35;
			}
			if (config.name === "chat-input") {
				config.y = 0.3;
			}
			buttons["submit chat"].yy = 0.3325;
		}
	} else {
		for (var config of ELEM_CONFIGS) {
			if (config.name === "player-chat") {
				config.h = 0.6;
			}
			if (config.name === "demon-chat") {
				config.h = 0.25;
				config.y = 0.7;
			}
			if (config.name === "chat-input") {
				config.y = 0.65;
			}
			buttons["submit chat"].yy = 0.6825;
		}
	}
	handleResize();
	chatIsDemon = thePlayer.isDemon;
}

///// Client-server functions \\\\\

function updateSettings() {
	socket.emit("update settings", theTable.settings);
}

function changeAvatar(avatarId) {
	Cookies.set("avatarId", avatarId);
	socket.emit("change avatar", avatarId);
}

function changeColor(color) {
	Cookies.set("color", color);
	socket.emit("change color", color);
}

function enableOverlay(theOverlay) {
	overlay = theOverlay;
	if ([OVERLAY_AVATAR, OVERLAY_HOWTO].includes(theOverlay)) toggleInputs();
}

function clearOverlay() {
	enableInputs();
	switch(overlay) {
		case OVERLAY_POPUP:
			buttons["clear popup"].disable();
			break;
		case OVERLAY_HOWTO:
			drawGroups["howto"].disable();
			break;
		case OVERLAY_AVATAR:
			drawGroups["avatar selection"].disable();
			buttons["clear avatar"].disable();
			break;
	}
	overlay = undefined;
}

function pageHowTo(inc) {
	howtoPage = (howtoPage + inc).mod(HOW_TO_PAGES);
}

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
		var avatarId = parseInt(Cookies("avatarId"));
		var color = Cookies("color");
		// TODO: make settings and send them here.
		if (name) {
			socket.emit("make table", name, avatarId, color, newTableSettings);
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
		var avatarId = parseInt(Cookies("avatarId"));
		var color = Cookies("color");
		if (name && code) {
			socket.emit("join table", code, name, avatarId, color);
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

		var newTimers = [];
		if (theTable) {
			for (var timer in table.timers) {
				if (theTable.timers[timer] !== table.timers[timer]) newTimers.push(timer);
			}
		}

		var change = !theTable || gameState != table.state;
		theTable = table;
		if (change) {
			changeState(table.state);
			setChatHeight();
		}
		// Update labels that use table data.
		for (var timer of newTimers) {
			setTimer(timer);
		}
		labels["message"].text = (thePlayer.isDemon && table.demonMessage) ? table.demonMessage : table.message;
		labels["table"].setData(table.code);
		labels["water_count"].setData(theTable.resources[WATER]);
		labels["board_count"].setData(theTable.resources[BOARD]);
		labels["rod_count"].setData(theTable.resources[ROD]);
		labels["exorcism_count"].setData(theTable.resources[EXORCISM]);
	} else {
		theTable = false;
		changeState(MAIN_MENU);
		labels["table"].setData("????");
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