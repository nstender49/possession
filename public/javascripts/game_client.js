// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

////////// Game states \\\\\\\\\\\\
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

const PLAYER_COLORS = [
	"#fbb7c5", "#8dd304", "#0089cc", "#98178e", "#ed6e01",  
	"#a37e30", "#ed2c34", "#144c2a", "#0046b6", "#512246", "#fdc918", 
	"#4c270c", "#000000", "#ffffff"
];

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

const ITEMS = [WATER, BOARD, ROD, EXORCISM];

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
BACK = "background";
BUTTON = "button";
TABLE = "table";
FAIL_X = "fail_x";
VOTED = "voted";
YES_VOTE = "vote_yes";
NO_VOTE = "vote_no";
PENTAGRAM  = "pentagram";
PENTAGRAM_GRAY = "pentagram_gray";
NAMEPLATE = "nameplate";
HOURGLASS = "hourgalss";

const IMAGES = [];
IMAGES[WATER] = new PreLoadedImage("/images/water.png");
IMAGES[BOARD] = new PreLoadedImage("/images/planchette.png");
IMAGES[ROD] = new PreLoadedImage("/images/rod.png");
IMAGES[EXORCISM] = new PreLoadedImage("/images/cross.png");
IMAGES[PASS] = new PreLoadedImage("/images/pass.png");

IMAGES[BACK] = new PreLoadedImage("/images/background.jpg");
IMAGES[BUTTON] = new PreLoadedImage("/images/button.png");
IMAGES[TABLE] = new PreLoadedImage("/images/table.png");
IMAGES[FAIL_X] = new PreLoadedImage("/images/fail_x.png");
IMAGES[VOTED] = new PreLoadedImage("/images/voted.png");
IMAGES[YES_VOTE] = new PreLoadedImage("/images/vote_yes.png");
IMAGES[NO_VOTE] = new PreLoadedImage("/images/vote_no.png");
IMAGES[PENTAGRAM] = new PreLoadedImage("/images/pentagram.png");
IMAGES[PENTAGRAM_GRAY] = new PreLoadedImage("/images/pentagram_gray.png");
IMAGES[NAMEPLATE] = new PreLoadedImage("/images/nameplate.png");
IMAGES[HOURGLASS] = new PreLoadedImage("/images/hourglass.png");

// Player images
const AVATAR_COUNT = 50;
const PLAYER_IMAGES = [];
for (var i = 0; i < AVATAR_COUNT; i++) {
	PLAYER_IMAGES[i] = new PreLoadedImage(`/images/avatars/${i}.png`);
}

// Debug settings
var DEBUG = false;
var logFull = true;

// Config settings received from server.
var newTableSettings = {
	// Table settings
	minPlayers: 2,
	maxPlayers: 12, 
	turnOrder: false,
	// Time limits
	roundTime: 300,
	discussTime: 30,
	moveTime: 30,
	secondTime: 10,
	selectTime: 15,
	voteTime: 30,
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
var demonChats = [];

// Display
var timers = [];
// Overlay
var overlay, popupMessage, howtoPage;
const HOW_TO_PAGES = 2;
const OVERLAY_POPUP = "pop up";
const OVERLAY_AVATAR = "avatar";
const OVERLAY_HOWTO = "how to";
const OVERLAY_SETTINGS = "settings";

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
	setChatHeight();
});

socket.on("possessed players", function(players) {
	if (players.length > possessedPlayers.length) {
		// New possessed player
		var container = document.getElementById("content");
		var newChat = document.createElement("ul");
		newChat.className = "demon-chat";
		newChat.style.display = "block";
		newChat.style.fontSize = (10 * r) + "px";
		demonChats.push(newChat);
		container.appendChild(newChat);
	} else {
		// Player no longer possessed
		for (var i = 0; i < possessedPlayers.length; i++) {
			if (!players.includes(possessedPlayers[i])) {
				var container = document.getElementById("content");
				container.removeChild(demonChats[i]);
				demonChats.splice(i, 1);
				break;
			}
		}
	}
	possessedPlayers = players;
	if (!possessedPlayers.includes(selectedPlayer)) selectedPlayer = possessedPlayers[0];
	handleResize();
});

socket.on("update interfere", function(uses) {
	interfereUses = uses;
	var print = []
	for (var item in interfereUses) {
		if (interfereUses[item] > 0) {
			print.push(`${item} (${interfereUses[item]})`);
		}
	}
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

//////////  Init static GUI elements  \\\\\\\\\\

function initLabels() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	// Main menu
	labels["title"] = new Label("POSSESSION", 80).setPosition(0.5, 0.4);
	buttons["make table"] = new Button("Make Table", 60, makeTable).setPosition(0.5, 0.55).setDims(0.445, 0.14).setCenter(true);
	buttons["join table"] = new Button("Join Table", 60, joinTable).setPosition(0.5, 0.80).setDims(0.445, 0.14).setCenter(true);
	drawGroups["main menu"] = new DrawGroup([
		labels["title"],
		buttons["make table"],
		buttons["join table"],
	]);

	// Table
	labels["table_img"] = new ImageLabel(IMAGES[TABLE]).setCenter(true).setPosition(0.3, 0.5).setDims(0.4)

	buttons["leave table"] = new Button("Leave Table", 15, leaveTable).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);
	buttons["begin game"] = new Button("Start Game", 15, doMove.bind(null, BEGIN)).setPosition(0.3, 0.4).setDims(0.15, 0.07).setCenter(true);
	buttons["change avatar"] = new Button("Change Avatar", 15, enableOverlay.bind(null, OVERLAY_AVATAR)).setPosition(0.3, 0.7).setDims(0.15, 0.07).setCenter(true);
	buttons["finish game"] = new Button("Finish Game", 15, doMove.bind(null, FINISH)).setPosition(0.3, 0.4).setDims(0.15, 0.07).setCenter(true);

	// Timers
	labels["move timer hourglass"] = new ImageLabel(IMAGES[HOURGLASS]).setPosition(0.28, 0.755).setDims(0.015);
	labels[MOVE_TIMER] = new Label("{}", 20).setPosition(0.32, 0.79);
	drawGroups[MOVE_TIMER] = new DrawGroup([labels["move timer hourglass"], labels[MOVE_TIMER]]);
	labels["round timer title"] = new Label("Round", 20).setPosition(0.26, 0.235);
	labels["round timer hourglass"] = new ImageLabel(IMAGES[HOURGLASS]).setPosition(0.295, 0.2).setDims(0.015);
	labels[ROUND_TIMER] = new Label("{}", 20).setPosition(0.375, 0.235).setAlign("right");
	drawGroups[ROUND_TIMER] = new DrawGroup([labels["round timer title"], labels["round timer hourglass"], labels[ROUND_TIMER]]);
	drawGroups["timers"] = new DrawGroup([drawGroups[MOVE_TIMER], drawGroups[ROUND_TIMER]]);

	// Items
	drawGroups["items"] = new DrawGroup();
	for (var item of ITEMS) {
		buttons[item] = new ImageButton(IMAGES[item], doMove.bind(null, item)).setCenter(true).setAbsolute(true);
		drawGroups["items"].add(buttons[item]);
	}
	buttons[PASS] = new Button("Pass", 15, doMove.bind(null, PASS)).setPosition(0.3, 0.525).setDims(0.075, 0.05).setCenter(true);
	
	drawGroups["items"].add(buttons[PASS]);

	// Planning phase
	buttons["ready"] = new Button("Advance Round", 15, doMove.bind(null, READY)).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);

	// Voting phase
	labels[WATER] = new ImageLabel(IMAGES[WATER]).setCenter(true);
	labels[BOARD] = new ImageLabel(IMAGES[BOARD]).setCenter(true);
	labels[ROD] = new ImageLabel(IMAGES[ROD]).setCenter(true);
	labels[EXORCISM] = new ImageLabel(IMAGES[EXORCISM]).setCenter(true);
	buttons["vote yes"] = new Button("Yes", 20, doVote.bind(null, true)).setPosition(0.25, 0.6).setSticky(true);
	buttons["vote no"] = new Button("No", 20, doVote.bind(null, false)).setPosition(0.35, 0.6).setSticky(true);
	drawGroups["voting"] = new DrawGroup([
		buttons["vote yes"],
		buttons["vote no"],
	]);

	// Chat
	buttons["submit chat"] = new Button("↵", 15, submitChat).setDims(undefined, 0.05).setCenter(true);
	labels["chat title"] = new Label("Player Chat", 15).setPosition(0.775, 0.05);
	buttons["next chat"] = new Button(">", 15, cycleChat).setDims(undefined, 0.05);
	drawGroups["chat"] = new DrawGroup([
		buttons["submit chat"],
		labels["chat title"],
		buttons["next chat"],
	])

	// Demon / interfere
	buttons["interfere yes"] = new Button("Yes", 20, doInterfere.bind(null, true)).setPosition(0, 0);
	buttons["interfere no"] = new Button("No", 20, doInterfere.bind(null, false)).setPosition(0, 0);
	drawGroups["interfere"] = new DrawGroup([
		buttons["interfere yes"],
		buttons["interfere no"],
	]);

	// Fast chat buttons
	buttons["fast vote yes"] = new Button("Vote Yes", 10, fastChat.bind(null, "vote yes")).setDims(0.06, 0.04).setPosition(0.39, 0.875);
	buttons["fast vote no"] = new Button("Vote No", 10, fastChat.bind(null, "vote no")).setDims(0.06, 0.04).setPosition(0.455, 0.875);
	buttons["fast suspect"] = new Button("Suspect", 10, fastChat.bind(null, "suspect")).setDims(0.06, 0.04).setPosition(0.52, 0.875);
	buttons["fast validate"] = new Button("Validate", 10, fastChat.bind(null, "validate")).setDims(0.06, 0.04).setPosition(0.585, 0.875);
	buttons["fast go along"] = new Button("Go Along", 10, fastChat.bind(null, "go along")).setDims(0.06, 0.04).setPosition(0.65, 0.875);
	drawGroups["fast chat"] = new DrawGroup([
		buttons["fast vote yes"],
		buttons["fast vote no"],
		buttons["fast suspect"],
		buttons["fast validate"],
		buttons["fast go along"],
	])
	for (var item of ITEMS) {
		buttons[`fast chat ${item}`] = new ImageButton(IMAGES[item], fastChat.bind(null, item)).setDims(0.04).setBackground(BUTTON_BACKGROUND).setMargin(5);
	}

	// Game settings (bottom bar)
	labels["table"] = new Label("Table {}", 15).setPosition(0.01, 0.98).setAlign("left").setData("????");
	buttons["howto"] = new Button("How To Play", 12, enableOverlay.bind(null, OVERLAY_HOWTO)).setPosition(0.15, 0.97).setDims(0.09, 0.04).setCenter(true);
	labels["error msg"] = new Label("", 20).setPosition(0.5, 0.98);
	labels["version"] = new Label("", 15).setPosition(0.99, 0.98).setAlign("right").setFont("monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		labels["table"],
		buttons["howto"],
		labels["error msg"],
		// buttons["sound"],
		labels["version"],
	]);

	// Pop up
	buttons["clear popup"] = new Button("OK", 20, clearOverlay).setPosition(0.3, 0.53).setOverlay();

	// How to play
	buttons["clear howto"] = new Button("Ok", 20, clearOverlay).setPosition(0.5, 0.91).setOverlay();
	buttons["howto >"] = new Button(">", 20, pageHowTo.bind(null, 1)).setPosition(0.9, 0.91).setOverlay();
	buttons["howto <"] = new Button("<", 20, pageHowTo.bind(null, -1)).setPosition(0.1, 0.91).setOverlay();
	drawGroups["howto"] = new DrawGroup([
		buttons["clear howto"],
		buttons["howto >"],
		buttons["howto <"]
	]);

	// Avatar selection
	buttons["clear avatar"] = new Button("✓", 40, clearOverlay).setPosition(0.955, 0.9).setOverlay();
	drawGroups["avatar selection"] = new DrawGroup([]);
	for (var i = 0; i < AVATAR_COUNT; i++) {
		buttons[`avatar ${i}`] = new ImageButton(PLAYER_IMAGES[i], changeAvatar.bind(null, i)).setAbsolute(true).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`avatar ${i}`]);
	}
	for (var color of PLAYER_COLORS) {
		buttons[`color ${color}`] = new ShapeButton(color, changeColor.bind(null, color)).setAbsolute(true).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`color ${color}`]);
	}

	// Sounds
	// sounds["count"] = new sound("/sounds/racestart.wav");
}

function disableInputs() {
	setElemDisplay();
	for (var c of demonChats) {
		displayElem(c, false);
	}
}

function enableInputs() {
	if (!theTable || theTable.state === MAIN_MENU) {
		setElemDisplay(["player-name", "game-code"]);
	} else {
		var inputs = ["chat-input"];
		inputs.push(labels["chat title"].text.toLowerCase().replace(" ", "-"));
		if (thePlayerIsPossessed) inputs.push("demon-chat");
		setElemDisplay(inputs);
		drawGroups["chat"].enable();

		if (thePlayer.isDemon) {
			for (var c of demonChats) {
				displayElem(c, true);
			}
		}
	}
}

function setElemDisplay(inputs = []) {
	for (var e of ELEM_CONFIGS) {
		displayElem(document.getElementById(e.name), inputs.includes(e.name));
	}
}

function displayElem(elem, doDisplay) {
	elem.style.display = doDisplay ? "block" : "none";
}


function cycleChat() {
	labels["chat title"].text = labels["chat title"].text === "Player Chat" ? "Game Log" : "Player Chat";
	enableInputs();
}

function setChatHeight() {
	if (!thePlayer || (thePlayer.isDemon && buttons["submit chat"].yy === 0.3325) || (thePlayerIsPossessed && buttons["submit chat"].yy === 0.6825)) return;
	if (thePlayer.isDemon) {
		labels["chat title"].setPosition(0.885, 0.23);
		buttons["next chat"].setPosition(0.965, 0.225);
		buttons["submit chat"].setPosition(0.67, 0.925);

		for (var config of ELEM_CONFIGS) {
			if (["player-chat", "game-log"].includes(config.name)) {
				config.x = 0.79;
				config.y = 0.25;
				config.w = 0.19;
				config.h = 0.60;
			}
			if (config.name === "chat-input") {
				config.x = 0.35;
				config.y = 0.90;
				config.w = 0.30;
				config.h = 0.05;
			}
		}
	} else {
		labels["chat title"].setPosition(0.775, 0.05); 
		buttons["next chat"].setPosition(0.935, 0.0425);

		if (thePlayerIsPossessed) {
			for (var config of ELEM_CONFIGS) {
				if (["player-chat", "game-log"].includes(config.name)) {
					config.x = 0.60;
					config.y = 0.07;
					config.w = 0.35;
					config.h = 0.58;
				} else if (config.name === "chat-input") {
					config.x = 0.60;
					config.y = 0.65;
					config.w = 0.32;
					config.h = 0.05;
				}
				buttons["submit chat"].setPosition(0.935, 0.675);
			}
		} else {
			for (var config of ELEM_CONFIGS) {
				if (["player-chat", "game-log"].includes(config.name)) {
					config.x = 0.60;
					config.y = 0.07;
					config.w = 0.35;
					config.h = 0.83;
				} else if (config.name === "chat-input") {
					config.x = 0.60;
					config.y = 0.90;
					config.w = 0.32;
					config.h = 0.05;
				}
				buttons["submit chat"].setPosition(0.935, 0.925);
			}
		}
	}
	handleResize();
}

function toggleSound(enable) {
	if (!enable) {
		for (var sound of sounds) {
			sound.stop();
		}
	}
	soundEnabled = enable;
}

var lastPlayer = undefined;
var chatBgnd = false;

function addMessage(chat, msg, player) {
	// Handle simple text messages;
	var item = document.createElement("li");
	var messages = document.getElementById(chat);

	if (chat === "player-chat") {
		if (player) {
			if (player !== lastPlayer) chatBgnd = !chatBgnd;
			lastPlayer = player;
			if (chatBgnd) item.style.background = "#575757";
			if (player === thePlayer.name) {
				item.style.textAlign = "right";
			} else {
				addMarkedUpContent(item, `<c>${player}</c>: `);
			}
		} else {
			messages = document.getElementById("game-log");
		}
	} else if (thePlayer.isDemon) {
		console.log(`GOT MESSAGE: ${chat} ${msg} ${player}`);
		var chatIdx = possessedPlayers.indexOf(player);
		messages = demonChats[chatIdx];
	}
	addMarkedUpContent(item, msg);
	messages.appendChild(item);
	item.scrollIntoView();
}

function addMarkedUpContent(item, content) {
	var stack = [item];
	var lastText;

	var index = 0
	while (true) {
		var next = content.indexOf('<', index);
		if (next === -1) break;
		if (next !== index) {
			lastText = content.substring(index, next)
			addSpan(stack[stack.length - 1], lastText);
		}
		index = next + 1;
		next = content.indexOf('>', index);
		var tag = content.substring(index, next);
		if (tag.startsWith("/")) {
			switch (tag.substring(1).toLowerCase()) {
				case "c":
					var player = getPlayerByName(lastText);
					if (player) stack[stack.length - 1].style.color = getPlayerByName(lastText).color;
					break;
				case "b": 
					stack[stack.length -1].style.fontWeight = "bold";
					break;
			}
			stack.pop();
		} else {
			stack.push(addSpan(stack[stack.length - 1]));
		}
		index = next + 1;
	}
	if (index !== content.length) addSpan(item, content.substring(index));
}

function addSpan(item, text) {
	var sp = document.createElement("span");
	if (text) sp.innerText = text;
	item.appendChild(sp);
	return sp;
}

function clearChat(chat) {
	document.getElementById(chat).innerHTML = "";
}

function removeDemonChats() {
	var container = document.getElementById("content");
	for (var chat of demonChats) {
		container.removeChild(chat);
	}
	demonChats = [];
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

	enableInputs();
	drawGroups["bottom bar"].enable();

	switch(state) {
		case INIT:
			overlay = undefined;
			howtoPage = 0;
			drawGroups["timers"].disable();
			removeDemonChats();
			break;
		case MAIN_MENU:
			overlay = undefined;
			removeDemonChats();
			buttons["make table"].enable();
			buttons["join table"].enable();
			clearChat("demon-chat");
			clearChat("game-log");
			break;
		case TABLE_LOBBY:
			overlay = undefined;
			thePlayerIsPossessed = false;
			possessedPlayers = [];
			removeDemonChats();
			buttons["leave table"].enable();
			buttons["change avatar"].enable();
			break;
		case TABLE_NIGHT:
			if (overlay !== OVERLAY_POPUP) overlay = undefined;
			break;
		case TABLE_DISCUSS:
			if (!thePlayer.isDemon) buttons["ready"].enable();
			break;
		case TABLE_DAY:
			var enabled = !thePlayer.isDemon && (!theTable.settings.turnOrder || thePlayer.sessionId === getCurrentPlayer().sessionId);
			if (enabled) {
				drawGroups["items"].enable();
			} else {
				drawGroups["items"].show();
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
			if (thePlayer.isDemon && interfereUses[theTable.currentMove.type] > 0) {
				drawGroups["interfere"].enable();
			}
			break;
		case TABLE_END:
			thePlayerIsPossessed = false;
			removeDemonChats();
	}
	gameState = state;
}

function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].socketId === socket.id;
}

function doMove(move) {
	if (move === READY) buttons["ready"].disable();
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

function selectPlayer(name) {
	if (thePlayer.isDemon) {
		if (gameState === TABLE_NIGHT) {
			socket.emit("do move", {type: SELECT, targetName: name});
		} else {
			if (possessedPlayers.includes(name)) {
				selectedPlayer = name;
			}
		}
	} else {
		if (gameState === TABLE_SELECT) {
			socket.emit("do move", {type: SELECT, targetName: name});
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

function getPlayerByName(name) {
	for (var player of theTable.players) {
		if (player.name === name) return player;
	}
	return false;
}

function getCurrentPlayer() {
	if (!theTable || !theTable.settings.turnOrder) return false;
	return theTable.players[theTable.currentPlayer]
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

function submitChat() {
	var input = document.getElementById("chat-input");
	if (input.value) {
		if (CTRL && thePlayer.isDemon) {
			for (var player of possessedPlayers) {
				socket.emit("chat msg", input.value, player);
			}
		} else {
			socket.emit("chat msg", input.value, thePlayer.isDemon ? selectedPlayer : false);
		}
		input.value = "";
	}
}

function fastChat(msg) {
	var input = document.getElementById("chat-input");
	input.value += msg + " ";
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
				buttons[player.name] = new ImageButton(PLAYER_IMAGES[player.avatarId], selectPlayer.bind(null, player.name)).setCenter(true).setAbsolute(true);
				var fastButton = new Button(player.name, 10, fastChat.bind(null, `<c>${player.name}</c>`)).setDims(0.045, 0.04);
				console.log(`ADDING BUTTON FOR ${player.name}: ${fastButton.textDims().width} ${fastButton.buttonDims().width}`);
				if (fastButton.textDims().width > fastButton.buttonDims().width * 0.75) {
					fastButton.text = player.name.substring(0, Math.floor(player.name.length * fastButton.buttonDims().width * 0.75 / fastButton.textDims().width));
				}
				buttons[`fast chat ${player.name}`] = fastButton;
				// TODO: remove deleted players...
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
			enableInputs();
		}
		// Update labels that use table data.
		for (var timer of newTimers) {
			setTimer(timer);
		}
		labels["table"].setData(table.code);
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

///// Utilities \\\\\\\

function enableOverlay(theOverlay) {
	overlay = theOverlay;
	if ([OVERLAY_AVATAR, OVERLAY_HOWTO].includes(theOverlay)) disableInputs();
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