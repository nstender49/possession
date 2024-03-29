// Config settings received from server.
const defaultNewTableSettings = {
	// Table settings
	minPlayers: 6,
	maxPlayers: 13, 
	turnOrder: false,
	waterPurify: true,
	items: {
		[constants.items.BOARD]: true,
		[constants.items.ROD]: true,
		[constants.items.SALT]: true,
		[constants.items.WATER]: true,
		[constants.items.EXORCISM]: true,
		[constants.items.SMUDGE]: true,
	},
	// Time limits
	times: {
		[constants.times.ROUND]: 300,
		[constants.times.DISCUSS]: 60,
		[constants.times.TURN]: 60,
		[constants.times.SECOND]: 10,
		[constants.times.VOTE]: 20,
		[constants.times.SELECT]: 20,
		[constants.times.INTERFERE]: 10,
		[constants.times.INTERPRET]: 10,
	}
};
const INC_SETTINGS = {
	[constants.times.ROUND]: {min: 300, max: 1800, inc: 60},
	[constants.times.DISCUSS]: {min: 0, max: 120, inc: 15},
	[constants.times.TURN]: {min: 30, max: 240, inc: 15},
	[constants.times.SECOND]: {min: 10, max: 60, inc: 5},
	[constants.times.VOTE]: {min: 10, max: 120, inc: 10},
	[constants.times.SELECT]: {min: 10, max: 120, inc: 10},
	[constants.times.INTERFERE]: {min: 10, max: 30, inc: 5},
	[constants.times.INTERPRET]: {min: 10, max: 30, inc: 5},
	"MIN_PLAYERS": {min: 3, max: 13, inc: 1},
	"MAX_PLAYERS": {min: 3, max: 13, inc: 1},
};
var newTableSettings = Cookies.getJSON("table settings") || defaultNewTableSettings;

////////// Game states \\\\\\\\\\\\

const BURNING_SMUDGE = "burning_smudge";
const BURNED_SMUDGE = "burned_smudge";

// Timers
ERROR_DURATION_SEC = 2.5,
PING_TIME_SEC = 180;

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
PENTAGRAM_RED = "pentagram_red";
NAMEPLATE = "nameplate";
HOURGLASS = "hourgalss";

const IMAGES = [];
IMAGES[constants.items.WATER] = new PreLoadedImage("/images/water.png");
IMAGES[constants.items.BOARD] = new PreLoadedImage("/images/planchette.png");
IMAGES[constants.items.ROD] = new PreLoadedImage("/images/rod.png");
IMAGES[constants.items.EXORCISM] = new PreLoadedImage("/images/cross.png");
IMAGES[constants.items.SALT] = new PreLoadedImage("/images/salt.png");
IMAGES[constants.items.SMUDGE] = new PreLoadedImage("/images/smudge_stick.png");
IMAGES[BURNING_SMUDGE] = new PreLoadedImage("/images/burning_smudge_stick.png");
IMAGES[BURNED_SMUDGE] = new PreLoadedImage("/images/burned_smudge_stick.png");
IMAGES[constants.moves.PASS] = new PreLoadedImage("/images/pass.png");

IMAGES[BACK] = new PreLoadedImage("/images/background.jpg");
IMAGES[TABLE] = new PreLoadedImage("/images/table.png");
IMAGES[FAIL_X] = new PreLoadedImage("/images/fail_x.png");
IMAGES[VOTED] = new PreLoadedImage("/images/voted.png");
IMAGES[YES_VOTE] = new PreLoadedImage("/images/vote_yes.png");
IMAGES[NO_VOTE] = new PreLoadedImage("/images/vote_no.png");
IMAGES[PENTAGRAM] = new PreLoadedImage("/images/pentagram.png");
IMAGES[PENTAGRAM_GRAY] = new PreLoadedImage("/images/pentagram_gray.png");
IMAGES[PENTAGRAM_RED] = new PreLoadedImage("/images/pentagram_red.png");
IMAGES[NAMEPLATE] = new PreLoadedImage("/images/nameplate.png");
IMAGES[HOURGLASS] = new PreLoadedImage("/images/hourglass.png");

// Player images
const PLAYER_IMAGES = [];
for (var i = 0; i < constants.AVATAR_COUNT; i++) {
	PLAYER_IMAGES[i] = new PreLoadedImage(`/images/avatars/${i}.png`);
}

// Debug settings
var DEBUG = false;
var logFull = true;

// Game settings
var soundEnabled = false;

// Game state
var socket = io();
var labels = [];
var buttons = [];
var elems = [];
var drawGroups = [];
var sounds = [];

// Game state
var gameState, theTable, playerId, thePlayerIds, thePlayer, thePlayerIsPossessed, rodResult;
// Demon state
var possessedPlayers, smudgedPlayer, interfereUses, selectedPlayer;
var demonChats = {};
var saltFlip = [false, false];

// Display
var timers = [];
var gameLogRatio = 0.5;
var demonChatRatio = 0.3;

// Overlay
var overlay, popupMessage, howtoPage;
const HOW_TO_PAGES = 2;
const OVERLAY_POPUP = "pop up";
const OVERLAY_AVATAR = "avatar";
const OVERLAY_HOWTO = "how to";
const OVERLAY_SETTINGS = "settings";
const OVERLAY_ACCEPT_DEMON = "accept demon";

//////////  Socket Events  \\\\\\\\\\

var ts = timesync.create({
	server: "/timesync",
	interval: 10000
});

socket.on("player id", function(id) {
	playerId = id;
});

socket.on("connect", function() {
	updateTable();
});

socket.on("update state", function(table) {
	updateTable(table);
});

socket.on("server error", function(msg) {
	raiseError(msg);
});

socket.on("chat msg", function(msg, sender) {
	console.log(`CHAT MSG: ${msg} ${sender}`);
	if (sender) addPlayerChat(msg, sender);
	else addMessage(elems["game-log"], msg);
});

socket.on("clear chat", function(chat) {
	clearChat(chat);
});

socket.on("demon msg", function(msg, id) {
	console.log(`DEMON MSG: ${msg} ${id} ${thePlayer.isDemon}`);
	if (thePlayer.isDemon) addDemonChat(msg, id);
	else addMessage(elems["demon-chat"], msg);
});

socket.on("pop up", function(msg) {
	popupMessage = msg;
	enableOverlay(OVERLAY_POPUP);
});

socket.on("accept demon", function() {
	drawGroups["accept demon"].enable();
	enableOverlay(OVERLAY_ACCEPT_DEMON);
});

socket.on("possession", function(isPossessed) {
	thePlayerIsPossessed = isPossessed;
	if (thePlayerIsPossessed) {
		buttons["demon-chat"].enable();
		elems["demon-chat"].show();
	} else {
		buttons["demon-chat"].disable();
	}
	setChatHeight();
});

socket.on("rod", function(isPossessed) {
	rodResult = isPossessed;
});

socket.on("salt flip", function(flipState) {
	saltFlip = flipState;
});

socket.on("possessed players", function(players) {
	Object.keys(demonChats).forEach(id => {
		if (!players.includes(id)) {
			demonChats[id].remove();
			delete demonChats[id];
		}
	});
	players.forEach(id => {
		if (id in demonChats) return;
		demonChats[id] = new DocumentElement("ul").setSize(10);
		demonChats[id].elem.className = "demon-chat";
		demonChats[id].show();
	});
	possessedPlayers = players;
	if (!possessedPlayers.includes(selectedPlayer)) selectedPlayer = possessedPlayers[0];
	handleResize();
});

socket.on("smudged player", function(player) {
	smudgedPlayer = player;
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

socket.on("init settings", function(settings) {
	labels["version"].text = settings.code_version ? `v${settings.code_version}` : "local";
	if (settings.DEBUG !== undefined) DEBUG = settings.DEBUG;
	if (DEBUG) {
		newTableSettings.minPlayers = 3;
		elems["player-name"].elem.value = "Player" + Math.floor(Math.random() * 100);
		elems["game-code"].elem.value = "AAAA";
	}
	handleResize();
});

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Init static GUI elements  \\\\\\\\\\

function initLabels() {
	labels["title"] = new Label("POSSESSION", 80).setPosition(0.5, 0.4);
	labels["disconnected"] = new Label("Waiting for server connection...", 20).setPosition(0.5, 0.92);
	labels["error msg"] = new Label("", 20).setPosition(0.5, 0.98);

	// Main menu
	buttons["make table"] = new Button("Make Table", 60, makeTable).setPosition(0.5, 0.55).setDims(0.427, 0.14).setCenter(true);
	buttons["join table"] = new Button("Join Table", 60, joinTable).setPosition(0.5, 0.80).setDims(0.427, 0.14).setCenter(true);
	drawGroups["main menu"] = new DrawGroup([
		labels["title"],
		buttons["make table"],
		buttons["join table"],
	]);
	elems["player-name"] = new DocumentElement("input", "player-name").setPosition(0.288, 0.63).setDims(0.3, 0.09).setSize(40);
	elems["player-name"].elem.maxLength = 16;
	elems["player-name"].elem.placeholder = "Player Name";
	elems["player-name"].elem.value = Cookies("name") || "";
	elems["game-code"] = new DocumentElement("input", "game-code").setPosition(0.594, 0.63).setDims(0.12, 0.09).setSize(40);
	elems["game-code"].elem.maxLength = 4;
	elems["game-code"].elem.placeholder = "CODE";
	elems["game-code"].elem.style.textTransform = "uppercase";

	// Table
	labels["table_img"] = new ImageLabel(IMAGES[TABLE]).setCenter(true).setPosition(0.3, 0.5).setDims(0.4)

	// Table lobby
	buttons["begin game"] = new Button("Start Game", 15, doMove.bind(null, constants.moves.BEGIN)).setPosition(0.3, 0.3).setDims(0.15, 0.07).setCenter(true);
	buttons["table settings"] = new Button("Table Settings", 15, enableOverlay.bind(null, OVERLAY_SETTINGS)).setPosition(0.3, 0.4).setDims(0.15, 0.07).setCenter(true);
	buttons["leave table"] = new Button("Leave Table", 15, leaveTable).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);
	buttons["change avatar"] = new Button("Change Avatar", 15, enableOverlay.bind(null, OVERLAY_AVATAR)).setPosition(0.3, 0.7).setDims(0.15, 0.07).setCenter(true);
	drawGroups["table lobby"] = new DrawGroup([
		buttons["leave table"],
		buttons["table settings"],
		buttons["begin game"],
		buttons["change avatar"],
	])
	buttons["finish game"] = new Button("Finish Game", 15, doMove.bind(null, constants.moves.FINISH)).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);

	// Timers
	labels["move timer hourglass"] = new ImageLabel(IMAGES[HOURGLASS]).setDims(0.015);
	labels[constants.timers.MOVE] = new Label("", 15);
	drawGroups[constants.timers.MOVE] = new DrawGroup([labels["move timer hourglass"], labels[constants.timers.MOVE]]);
	labels["round timer title"] = new Label("Round 1", 15);
	labels["round timer hourglass"] = new ImageLabel(IMAGES[HOURGLASS]).setDims(0.015);
	labels[constants.timers.ROUND] = new Label("", 15).setAlign("right");
	drawGroups[constants.timers.ROUND] = new DrawGroup([labels["round timer title"], labels["round timer hourglass"], labels[constants.timers.ROUND]]);
	drawGroups["timers"] = new DrawGroup([drawGroups[constants.timers.MOVE], drawGroups[constants.timers.ROUND]]);

	// Items
	drawGroups["items"] = new DrawGroup();
	Object.values(constants.items).map(item => {
		buttons[item] = new ImageButton(IMAGES[item], useItem.bind(null, item)).setCenter(true).setAbsolute(true);
		drawGroups["items"].add(buttons[item]);
	});
	buttons[constants.moves.PASS] = new Button("Pass", 15, doMove.bind(null, constants.moves.PASS)).setPosition(0.3, 0.54).setDims(0.05, 0.05).setCenter(true);
	drawGroups["items"].add(buttons[constants.moves.PASS]);

	// Accept demon nomination
	labels["accept demon 1"] = new Label("The forces of Hell have nominated you as demon!", 15).setPosition(0.3, 0.46);
	labels["accept demon 2"] = new Label("Playing as demon can be difficult if you are not familiar with the game. Accept?", 10).setPosition(0.3, 0.49);
	buttons["accept demon yes"] = new Button("Yes", 20, acceptDemon.bind(null, true)).setDims(0.05, 0.05).setPosition(0.25, 0.53).setCenter(true).setOverlay();
	buttons["accept demon no"] = new Button("No", 20, acceptDemon.bind(null, false)).setDims(0.05, 0.05).setPosition(0.35, 0.53).setCenter(true).setOverlay();
	drawGroups["accept demon"] = new DrawGroup([
		labels["accept demon 1"],
		labels["accept demon 2"],
		buttons["accept demon yes"],
		buttons["accept demon no"],
	]);

	// Planning phase
	buttons["ready"] = new Button("Advance Round", 15, doMove.bind(null, constants.moves.READY)).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);

	// Voting phase
	buttons["vote yes"] = new Button("Yes", 20, doVote.bind(null, true)).setDims(0.05, 0.05).setPosition(0.25, 0.6).setCenter(true).setSticky(true);
	buttons["vote no"] = new Button("No", 20, doVote.bind(null, false)).setDims(0.05, 0.05).setPosition(0.35, 0.6).setCenter(true).setSticky(true);
	drawGroups["voting"] = new DrawGroup([
		buttons["vote yes"],
		buttons["vote no"],
	]);

	// Items images for displaying - TODO: needed?
	Object.values(constants.items).map(item => {
		labels[item] = new ImageLabel(IMAGES[item]).setPosition(0.3, 0.35).setDims(0.1).setCenter(true);
	});

	// Rod interpret phase
	buttons["rod show"] = new Button("Show", 20, doInterpret.bind(null, true)).setDims(0.06, 0.05).setPosition(0.2, 0.6).setCenter(true).setSticky(true);
	buttons["rod hide"] = new Button("Hide", 20, doInterpret.bind(null, undefined)).setDims(0.06, 0.05).setPosition(0.3, 0.6).setCenter(true).setSticky(true);
	buttons["rod lie"] = new Button("Lie", 20, doInterpret.bind(null, false)).setDims(0.06, 0.05).setPosition(0.4, 0.6).setCenter(true).setSticky(true);
	drawGroups["rod"] = new DrawGroup([
		buttons["rod show"],
		buttons["rod hide"],
		buttons["rod lie"],
	]);

	// Chat
	buttons["submit chat"] = new Button("↵", 15, submitChat).setDims(undefined, 0.05).setCenter(true).setPausable(false);
	buttons["game-log"] = new DragableDivider("Game Log", 10, setChatHeight);
	buttons["demon-chat"] = new DragableDivider("Demon Chat", 10, setChatHeight);
	buttons["player-chat"] = new DragableDivider("Player Chat", 10, setChatHeight);
	drawGroups["chat"] = new DrawGroup([
		buttons["submit chat"],
		buttons["game-log"],
		buttons["demon-chat"],
		buttons["player-chat"],
	]);
	elems["chat-input"] = new DocumentElement("input", "chat-input").setPosition(0.6, 0.9).setDims(0.32, 0.05).setSize(10);
	elems["chat-input"].autocomplete = "off";
	elems["player-chat"] = new DocumentElement("ul", "player-chat").setPosition(0.6, 0.07).setDims(0.35, 0.83).setSize(10);
	elems["game-log"] = new DocumentElement("ul", "game-log").setPosition(0.6, 0.07).setDims(0.35, 0.83).setSize(10);
	elems["demon-chat"] = new DocumentElement("ul", "demon-chat").setPosition(0.6, 0.07).setDims(0.35, 0.25).setSize(10);
	elems["demon-chat"].elem.className = "demon-chat";

	// Demon / interfere
	labels["interfere"] = new Label("Interfere:", 20).setPosition(0.62, 0.23);
	buttons["interfere yes"] = new Button("Yes", 20, doInterfere.bind(null, true)).setDims(0.05, 0.05).setPosition(0.695, 0.22).setCenter(true).setSticky(true);
	buttons["interfere no"] = new Button("No", 20, doInterfere.bind(null, false)).setDims(0.05, 0.05).setPosition(0.75, 0.22).setCenter(true).setSticky(true);
	drawGroups["interfere"] = new DrawGroup([
		labels["interfere"],
		buttons["interfere yes"],
		buttons["interfere no"],
	]);
	labels["salt interfere 0"] = new Label("Interfere Group 1:", 15).setPosition(0.635, 0.21);
	labels["salt interfere 1"] = new Label("Interfere Group 2:", 15).setPosition(0.635, 0.245);
	buttons["salt interfere 0 yes"] = new Button("Yes", 15, saltInterfere.bind(null, 0, true)).setDims(0.03, 0.03).setPosition(0.72, 0.2).setCenter(true).setSticky(true);
	buttons["salt interfere 0 no"] = new Button("No", 15, saltInterfere.bind(null, 0, false)).setDims(0.03, 0.03).setPosition(0.76, 0.2).setCenter(true).setSticky(true);
	buttons["salt interfere 1 yes"] = new Button("Yes", 15, saltInterfere.bind(null, 1, true)).setDims(0.03, 0.03).setPosition(0.72, 0.235).setCenter(true).setSticky(true);
	buttons["salt interfere 1 no"] = new Button("No", 15, saltInterfere.bind(null, 1, false)).setDims(0.03, 0.03).setPosition(0.76, 0.235).setCenter(true).setSticky(true);
	drawGroups["salt interfere"] = new DrawGroup([
		labels["salt interfere 0"],
		buttons["salt interfere 0 yes"],
		buttons["salt interfere 0 no"],
		labels["salt interfere 1"],
		buttons["salt interfere 1 yes"],
		buttons["salt interfere 1 no"],
	]);

	// Fast chat buttons
	drawGroups["fast chat"] = new DrawGroup();
	var dx = 0.375;
	for (var t of ["Use", "Vote Y", "Vote N", "Sus", "No Sus", "Agree w/", "STFU"]) {
		buttons[`fast ${t}`] = new Button(t, 10, fastChat.bind(null, t)).setDims(0.045, 0.04).setPosition(dx, 0.875).setPausable(false);
		drawGroups["fast chat"].add(buttons[`fast ${t}`]);
		dx += 0.048;
	}
	Object.values(constants.items).map(item => {
		buttons[`fast chat ${item}`] = new ImageButton(IMAGES[item], fastChat.bind(null, item)).setDims(0.04).setBackground(BUTTON_BACKGROUND).setMargin(5).setPausable(false);
	});

	// Game settings (bottom bar)
	buttons["table code"] = new Button("Table ????", 12, toggleShowTable).setPosition(0.05, 0.97).setDims(0.09, 0.04).setCenter(true).setPausable(false);
	buttons["howto"] = new Button("How To Play", 12, enableOverlay.bind(null, OVERLAY_HOWTO)).setPosition(0.15, 0.97).setDims(0.09, 0.04).setCenter(true).setPausable(false);
	buttons["pause"] = new Button("Pause Game", 12, pauseGame).setPosition(0.85, 0.97).setDims(0.09, 0.04).setCenter(true).setPausable(false);
	labels["version"] = new Label("", 15).setPosition(0.99, 0.98).setAlign("right").setFont("monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		buttons["table code"],
		buttons["howto"],
		labels["error msg"],
		// buttons["sound"],
		labels["version"],
	]);

	// Pop up
	buttons["clear popup"] = new Button("OK", 20, clearOverlay).setDims(0.05, 0.05).setOverlay().setCenter(true);

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
	buttons["clear avatar"] = new Button("✓", 40, clearOverlay).setDims(0.06).setPosition(0.955, 0.88).setCenter(true).setOverlay();
	drawGroups["avatar selection"] = new DrawGroup([]);
	for (var i = 0; i < constants.AVATAR_COUNT; i++) {
		buttons[`avatar ${i}`] = new ImageButton(PLAYER_IMAGES[i], changeAvatar.bind(null, i)).setAbsolute(true).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`avatar ${i}`]);
	}
	for (var color of constants.PLAYER_COLORS) {
		buttons[`color ${color}`] = new ShapeButton(color, changeColor.bind(null, color)).setAbsolute(true).setOverlay();
		drawGroups["avatar selection"].draws.push(buttons[`color ${color}`]);
	}

	// Settings
	buttons["submit settings"] = new Button("Submit", 20, clearOverlay).setDims(0.08, 0.06).setPosition(0.5, 0.9).setCenter(true).setOverlay();
	drawGroups["settings"] = new DrawGroup([buttons["submit settings"]]);
	for (var setting of Object.values(constants.items).concat(["order", "purify"])) {
		buttons[`enable ${setting}`] = new Button("✓", 20, toggleSetting.bind(null, setting, true)).setDims(0.03).setCenter(true).setSticky(true).setOverlay();
		buttons[`disable ${setting}`] = new Button("X", 20, toggleSetting.bind(null, setting, false)).setDims(0.03).setCenter(true).setSticky(true).setOverlay();
		drawGroups["settings"].add(buttons[`enable ${setting}`]);
		drawGroups["settings"].add(buttons[`disable ${setting}`]);
	}
	for (var setting in INC_SETTINGS) {
		buttons[`decrease ${setting}`] = new Button("<", 20, incSetting.bind(null, setting, false)).setDims(0.03).setCenter(true).setOverlay().setHoldable(true);
		buttons[`increase ${setting}`] = new Button(">", 20, incSetting.bind(null, setting, true)).setDims(0.03).setCenter(true).setOverlay().setHoldable(true);
		drawGroups["settings"].add(buttons[`decrease ${setting}`]);
		drawGroups["settings"].add(buttons[`increase ${setting}`]);
	}

	// Salt
	for (var i = 0; i < 12; i++) {
		buttons[`salt ${i}`] = new ImageButton(IMAGES[constants.items.SALT], updateSalt.bind(null, i)).setDims(0.025).setAbsolute(true).setCenter(true);
	}
	buttons["submit salt"] = new Button("Submit", 20, doSalt).setDims(0.075, 0.05).setPosition(0.25, 0.6).setCenter(true);
	buttons["clear salt"] = new Button("Clear", 20, updateSalt).setDims(0.075, 0.05).setPosition(0.35, 0.6).setCenter(true);
	drawGroups["salt"] = new DrawGroup([
		buttons["submit salt"],
		buttons["clear salt"],
	]);
}

////////// Input elements \\\\\\\\\\

function disableInputs() {
	setElemDisplay();
	Object.values(demonChats).forEach(c => c.hide());
}

function setElemDisplay(toShow = []) {
	for (var name in elems) {
		toShow.includes(name) ? elems[name].show() : elems[name].hide();
	}
}

function enableInputs() {
	switch (gameState) {
		case undefined:
		case constants.states.INIT:
		case constants.states.MAIN_MENU: {
			let inputs = ["player-name", "game-code"];
			if (DEBUG) inputs.push("sessionId");
			setElemDisplay(inputs);
			break;
		}
		default: {
			let inputs = ["chat-input", "game-log", "player-chat"];
			drawGroups["chat"].enable();
			if (thePlayerIsPossessed) {
				inputs.push("demon-chat");
			} else {
				buttons["demon-chat"].disable();
			}
			setElemDisplay(inputs);
			if (thePlayer.isDemon) Object.values(demonChats).forEach(c => c.show());
			break;
		}
	}
}

function setChatHeight() {
	if (!thePlayer) return;
	if (thePlayer.isDemon) {
		const CHAT_X = 0.79;
		const CHAT_W = 0.19;
		const CHAT_TOP = 0.25;
		const CHAT_BOT = 0.80;
		const CHAT_HEIGHT = CHAT_BOT - CHAT_TOP;
		const DIV_HEIGHT = 0.025;

		// Transitioning from human to demon.
		if (buttons["game-log"].xx !== CHAT_X) {

			for (var name of ["game-log", "player-chat"]) {
				buttons[name].setDims(CHAT_W, DIV_HEIGHT);
			}

			buttons["game-log"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);
			buttons["player-chat"].setPosition(CHAT_X, CHAT_TOP + CHAT_HEIGHT * 0.5);

			elems["chat-input"].setPosition(0.35, 0.9).setDims(0.3, 0.05);

			buttons["player-chat"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);

			buttons["submit chat"].setPosition(0.67, 0.925);

			labels["round timer title"].setPosition(0.815, 0.84);
			labels["round timer hourglass"].setPosition(0.845, 0.805);
			labels[constants.timers.ROUND].setPosition(0.91, 0.84);
			labels["move timer hourglass"].setPosition(0.92, 0.805);
			labels[constants.timers.MOVE].setPosition(0.957, 0.84);
		}

		// Set chats based on dividers
		for (var name of ["game-log", "player-chat"]) {
			elems[name].setPosition(CHAT_X, buttons[name].yy + DIV_HEIGHT);
		}
		elems["game-log"].setDims(CHAT_W, buttons["player-chat"].yy - elems["game-log"].yy);
		elems["player-chat"].setDims(CHAT_W, CHAT_BOT - elems["player-chat"].yy);
	} else {		
		const CHAT_X = 0.60;
		const CHAT_W = 0.35;
		const CHAT_TOP = 0.02;
		const CHAT_BOT = 0.90;
		const CHAT_HEIGHT = CHAT_BOT - CHAT_TOP;
		const DIV_HEIGHT = 0.025;

		if (buttons["demon-chat"].xx !== CHAT_X) buttons["demon-chat"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);

		// Transitioning from demon to human
		if (buttons["game-log"].xx !== CHAT_X) {
			for (var name of ["game-log", "player-chat", "demon-chat"]) {
				buttons[name].setDims(CHAT_W, DIV_HEIGHT);
			}

			buttons["game-log"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);
			buttons["player-chat"].setPosition(CHAT_X, CHAT_TOP + CHAT_HEIGHT * 0.5);

			elems["chat-input"].setPosition(0.6, CHAT_BOT).setDims(0.32, 0.05);	

			buttons["submit chat"].setPosition(0.935, 0.925);

			labels["move timer hourglass"].setPosition(0.28, 0.755);
			labels[constants.timers.MOVE].setPosition(0.32, 0.79);
			labels["round timer title"].setPosition(theTable.settings.turnOrder ? 0.3 : 0.26, 0.235);
			labels["round timer hourglass"].setPosition(0.295, 0.2);
			labels[constants.timers.ROUND].setPosition(0.365, 0.235);
		}

		if (thePlayerIsPossessed) {
			// Transitioning into possessed
			if (buttons["game-log"].yy === CHAT_TOP) {
				var playerHeightRatio = buttons["player-chat"].yy / CHAT_HEIGHT;
				buttons["game-log"].yy = 0.3;
				buttons["player-chat"].yy = 0.3 + (CHAT_HEIGHT - 0.3) * playerHeightRatio;
			}
			buttons["game-log"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, buttons["player-chat"].yy - DIV_HEIGHT);
			buttons["player-chat"].setFixed(false).setLimits(buttons["game-log"].yy + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);
		} else {
			// Transitioning out of possessed
			if (buttons["game-log"].yy !== CHAT_TOP) {
				var playerHeightRatio = (buttons["player-chat"].yy - buttons["game-log"].yy) / (CHAT_BOT - buttons["game-log"].yy);
				buttons["player-chat"].yy = CHAT_HEIGHT * playerHeightRatio;
				buttons["game-log"].setPosition(0.6, CHAT_TOP).setFixed(true);
			}
			buttons["player-chat"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);
		}

		for (var name of ["demon-chat", "game-log", "player-chat"]) {
			elems[name].setPosition(CHAT_X, buttons[name].yy + DIV_HEIGHT);
		}
		elems["demon-chat"].setDims(CHAT_W, buttons["game-log"].yy - elems["demon-chat"].yy);
		elems["game-log"].setDims(CHAT_W, buttons["player-chat"].yy - elems["game-log"].yy);
		elems["player-chat"].setDims(CHAT_W, CHAT_BOT - elems["player-chat"].yy);
	}
	resizeElems();
}

////////// Chat logic \\\\\\\\\\\\

var lastSender = undefined;
var chatBgnd = false;
function addPlayerChat(msg, senderName) {
	// Handle simple text messages;
	let item = document.createElement("li");
	if (senderName !== lastSender) chatBgnd = !chatBgnd;
	lastSender = senderName;
	if (chatBgnd) item.style.background = "#575757";
	if (senderName === thePlayer.name) {
		item.style.textAlign = "right";
	} else {
		addMarkedUpContent(item, `<c>${senderName}</c>: `);
	}
	addMessage(elems["player-chat"], msg, item);
}

function addDemonChat(msg, id) {
	const chat = demonChats[id];
	if (!chat) return;
	addMessage(demonChats[id], msg);
}

function addMessage(container, msg, item) {
	item = item || document.createElement("li");
	addMarkedUpContent(item, msg);
	container.appendChild(item);
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
					if (player) stack[stack.length - 1].style.color = player.color;
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
	elems[chat].elem.innerHTML = "";
}

function removeDemonChats() {
	Object.values(demonChats).forEach(chat => chat.remove());
	demonChats = {};
}

/////////// Game logic \\\\\\\\\\\\

function changeState(state) {
	if (state === gameState) return;

	for (var button of Object.values(buttons)) button.disable();

	drawGroups["bottom bar"].enable();

	switch(state) {
		case constants.states.INIT:
			overlay = undefined;
			howtoPage = 0;
			drawGroups["timers"].disable();
			drawGroups["main menu"].disable().show();
			clearChats();
			break;
		case constants.states.MAIN_MENU:
			overlay = undefined;
			thePlayerIds = [];
			drawGroups["main menu"].enable();
			labels["error msg"].text = "";
			clearChats();
			break;
		case constants.states.LOBBY:
			overlay = undefined;
			thePlayerIsPossessed = false;
			possessedPlayers = [];
			clearChats();
			drawGroups["table lobby"].enable();
			break;
		case constants.states.DEMON_SELECTION:
			break;
		case constants.states.NIGHT:
			if (overlay !== OVERLAY_POPUP) overlay = undefined;
			break;
		case constants.states.DISCUSS:
			if (!thePlayer.isDemon) buttons["ready"].enable();
			break;
		case constants.states.DAY:
			var enabled = !thePlayer.isDemon && (!theTable.settings.turnOrder || thePlayer.id === getCurrentPlayer().id);
			if (enabled) {
				drawGroups["items"].enable();
			} else {
				drawGroups["items"].show();
			}
			break;
		case constants.states.SECONDING: 
			if (!(thePlayer.isDemon || theTable.currentMove.playerId === thePlayer.id)) {
				drawGroups["voting"].enable();
			}
			break;
		case constants.states.VOTING:
			if (!thePlayer.isDemon) {
				drawGroups["voting"].enable();
			}
			break;
		case constants.states.SELECT:
			if (theTable.currentMove.playerId === thePlayer.id && theTable.currentMove.type === constants.items.SALT) {
				drawGroups["salt"].enable();
				updateSalt();
			}
			break;
		case constants.states.INTERPRET:
			if (thePlayer.id === theTable.currentMove.playerId) drawGroups["rod"].enable();
			break;
		case constants.states.INTERFERE:
			if (thePlayer.isDemon && interfereUses[theTable.currentMove.type] > 0) drawGroups[`${theTable.currentMove.type === constants.items.SALT ? "salt " : ""}interfere`].enable();
			break;
		case constants.states.END:
			thePlayerIsPossessed = false;
			smudgedPlayer = undefined;
			possessedPlayers = [];
			removeDemonChats();
	}
	gameState = state;
	enableInputs();
}

/////////// Buttons \\\\\\\\\\\\\\\

function toggleSetting(setting, enable) {
	switch(setting) {
		case "order":
			theTable.settings.turnOrder = enable;
			break;
		case "purify":
			theTable.settings.waterPurify = enable;
			break;
		default:
			theTable.settings.items[setting] = enable;
			break;
	}
	buttons[`${enable ? "disable" : "enable"} ${setting}`].clicked = false;
}

function incSetting(setting, increase) {
	var min = INC_SETTINGS[setting].min;
	var max = INC_SETTINGS[setting].max;
	var inc = INC_SETTINGS[setting].inc;
	switch(setting) {
		case "MIN_PLAYERS":
			theTable.settings.minPlayers = Math.min(max, Math.max(min, theTable.settings.minPlayers + inc * (increase ? 1 : -1)));
			break;
		case "MAX_PLAYERS":
			theTable.settings.maxPlayers = Math.min(max, Math.max(min, theTable.settings.maxPlayers + inc * (increase ? 1 : -1)));
			break;
		default:
			theTable.settings.times[setting] = Math.min(max, Math.max(min, theTable.settings.times[setting] + inc * (increase ? 1 : -1)));
			break;
	}
}

function doMove(move) {
	if (move === constants.moves.READY) buttons["ready"].disable();
	socket.emit("do move", {type: move});
}

function useItem(item) {
	socket.emit("do move", {type: constants.moves.USE_ITEM, item: item});
}

function doVote(vote) {
	buttons[vote ? "vote no" : "vote yes"].clicked = false;
	socket.emit("do move", {type: gameState === constants.states.SECONDING ? constants.moves.SECOND : constants.moves.VOTE, vote: vote});
}

function doInterpret(vote) {
	buttons["rod show"].clicked = vote === true;
	buttons["rod hide"].clicked = vote === undefined;
	buttons["rod lie"].clicked = vote === false;
	socket.emit("do move", {type: constants.moves.INTERPRET, choice: vote});
}

function doInterfere(vote) {
	buttons[vote ? "interfere no" : "interfere yes"].clicked = false;
	socket.emit("do move", {type: constants.moves.INTERFERE, vote: vote});
}

function pauseGame() {
	socket.emit("do move", {type: constants.moves.PAUSE});
}

function toggleShowTable() {
	socket.emit("do move", {type: constants.moves.SHOW_CODE});
}

function saltInterfere(group, doInterfere) {
	buttons[`salt interfere ${group} ${doInterfere ? "no" : "yes"}`].clicked = false;
	socket.emit("do move", {type: constants.moves.INTERFERE, flipGroup: group, vote: doInterfere});
}

function doSalt() {
	if (theTable.saltLine.start === undefined || theTable.saltLine.end === undefined) return; 
	socket.emit("do move", {type: constants.moves.SELECT});
}

function acceptDemon(accept) {
	socket.emit("do move", {type: constants.moves.ACCEPT_DEMON, accept: accept});
	clearOverlay();
}

function updateSalt(pos) {
	if (pos === undefined) {
		theTable.saltLine.start = undefined;
		theTable.saltLine.end = undefined;
		for (var i = 0; i < theTable.players.length - 1; i++) {
			buttons[`salt ${i}`].enable();
		}
		buttons["submit salt"].disable().show();
		buttons["clear salt"].disable().show();
	} else if (theTable.saltLine.start !== undefined) {
		if (pos < theTable.saltLine.start) {
			theTable.saltLine.end = theTable.saltLine.start;
			theTable.saltLine.start = pos;
		} else {
			theTable.saltLine.end = pos;
		}
		for (var i = 0; i < theTable.players.length - 1; i++) {
			buttons[`salt ${i}`].disable();
		}
		buttons["submit salt"].enable();
	} else {
		theTable.saltLine.start = pos;
		for (var i = -1; i < 2; i++) {
			buttons[`salt ${(pos + i).mod(theTable.players.length - 1)}`].disable();
		}
		buttons["clear salt"].enable();
	}
	socket.emit("do move", {type: constants.moves.SELECT, line: theTable.saltLine});
}

function selectPlayer(id) {
	if (thePlayer.isDemon) {
		if (gameState === constants.states.NIGHT) {
			socket.emit("do move", {type: constants.moves.SELECT, targetId: id});
		} else {
			if (possessedPlayers.includes(id)) {
				selectedPlayer = id;
			}
		}
	} else {
		if (gameState === constants.states.SELECT) {
			socket.emit("do move", {type: constants.moves.SELECT, targetId: id});
		}
	}
}

function cycleActivePlayer(forward) {
	if (thePlayer.isDemon) {
		var index = possessedPlayers.indexOf(selectedPlayer);
		index = (index + (forward ? 1 : -1)).mod(possessedPlayers.length);
		selectedPlayer = possessedPlayers[index];
	}
}

function changeAvatar(avatarId) {
	Cookies.set("avatarId", avatarId);
	socket.emit("update player settings", {avatarId: avatarId});
}

function changeColor(color) {
	Cookies.set("color", color);
	socket.emit("update player settings", {color: color});
}

function submitChat() {
	const input = elems["chat-input"].elem;
	if (input.value) {
		if (ALT && thePlayer.isDemon) {
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
	elems["chat-input"].elem.value += msg + " ";
}

function makeTable() {
	if (!socket.connected) raiseError("No connection to server");

	const name = elems["player-name"].elem.value.trim();
	if (!name) raiseError("Must provide name to create table");
	else {
		const playerSettings = {
			name: name,
			avatarId: parseInt(Cookies("avatarId")),
			color: Cookies("color"),
		}
		Cookies.set("name", name);
		socket.emit("make table", newTableSettings, playerSettings);
	}
}

function joinTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (!socket.connected) raiseError("No connection to server");

	const name = elems["player-name"].elem.value.trim();
	const code = elems["game-code"].elem.value.trim();
	if (!name) raiseError("Must provide name and table code to join table");
	else if (!code) raiseError("Must provide name and table code to join table");
	else {
		const playerSettings = {
			name: name,
			avatarId: parseInt(Cookies("avatarId")),
			color: Cookies("color"),
		}
		Cookies.set("name", name);
		socket.emit("join table", code, playerSettings);
	}
}

function updateTable(table) {
	if (!table) {
		theTable = undefined;
		changeState(constants.states.MAIN_MENU);
		buttons["table code"].text = "Table ????";
		return;
	}

	// Update players
	// TODO: replace with per player updates?
	const latestPlayerIds = [];
	table.players.forEach(player => {
		latestPlayerIds.push(player.id);
		if (player.id === playerId) thePlayer = player;
		if (thePlayerIds.includes(player.id)) return;
		// Make button avatars for players if they don't exist
		buttons[`${player.id}`] = new ImageButton(PLAYER_IMAGES[player.avatarId], selectPlayer.bind(null, player.id)).setCenter(true).setAbsolute(true);
		var fastButton = new Button(player.name, 10, fastChat.bind(null, `<c>${player.name}</c>`)).setDims(0.045, 0.04);
		if (fastButton.textDims().width > fastButton.buttonDims().width * 0.75) {
			fastButton.text = player.name.substring(0, Math.floor(player.name.length * fastButton.buttonDims().width * 0.75 / fastButton.textDims().width));
		}
		fastButton.setPausable(false);
		buttons[`fast chat ${player.id}`] = fastButton;
	});
	const removedPlayerIds = thePlayerIds.filter(id => !latestPlayerIds.includes(id));
	thePlayerIds = latestPlayerIds;
	removedPlayerIds.forEach(id => {
		delete buttons[`${id}`];
		delete buttons[`fast chat ${id}`];
	});
	console.log(`TABLE UPDATED!!! ${thePlayer.isDemon}`);

	// Update state.
	var change = !theTable || gameState != table.state;
	theTable = table;
	buttons["pause"].text = theTable.paused ? "Resume Game": "Pause Game";
	buttons["table code"].text = theTable.showCode ? `Table ${theTable.code}` : "Table ????";
	labels["round timer title"].text = `Round ${table.round}`;
	if (change) {
		changeState(table.state);
		setChatHeight();
		enableInputs();
	}
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
}

function handleServerDisconnect() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	raiseError("Server disconnected!");
	// TODO: once db backup is added, remove this, disable buttons.
	changeState(constants.states.INIT);
	theTable = undefined;
}

function clearChats() {
	["game-log", "player-chat", "demon-chat"].forEach(chat => clearChat(chat));
	removeDemonChats();
}

/////////// Utilities \\\\\\\\\

function enableOverlay(theOverlay) {
	overlay = theOverlay;
	switch(overlay) {
		case OVERLAY_POPUP:
			buttons["clear popup"].enable();
			break;
		case OVERLAY_HOWTO:
			drawGroups["howto"].enable();
			disableInputs();
			break;
		case OVERLAY_AVATAR:
			drawGroups["avatar selection"].enable();
			buttons["clear avatar"].enable();
			disableInputs();
			break;
		case OVERLAY_ACCEPT_DEMON:
			drawGroups["accept demon"].enable();
			break;
		case OVERLAY_SETTINGS:
			drawGroups["settings"].enable();
			for (var setting of Object.values(constants.items).concat(["order", "purify"])) {
				var set = theTable.settings.items[setting];
				switch(setting) {
					case "order":
						set = theTable.settings.turnOrder;
						break;
					case "purify":
						set = theTable.settings.waterPurify;
						break;
				}
				buttons[`${set ? "enable" : "disable"} ${setting}`].clicked = true;
			}
			disableInputs();
			break;
	}
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
		case OVERLAY_ACCEPT_DEMON:
			drawGroups["accept demon"].disable();
			break;
		case OVERLAY_SETTINGS:
			drawGroups["settings"].disable();
			Cookies.set("table settings", theTable.settings);
			socket.emit("update settings", theTable.settings);
			break;
	}
	overlay = undefined;
}

function pageHowTo(inc) {
	howtoPage = (howtoPage + inc).mod(HOW_TO_PAGES);
}

function raiseError(msg) {
	labels["error msg"].text = msg;
	setTimeout(fadeLabel.bind(null, "error msg", true), ERROR_DURATION_SEC * 10);
}

function fadeLabel(label, start) {
	//console.log(`IN FADE LABEL ${labels[label].opacity} ${start}`)
	if (start) {
		labels[label].opacity = 100;
		labels[label].visible = true;
	} else {
		labels[label].opacity -= 1;
	}
	if (labels[label].opacity > 0) {
		//console.log(`\tCALLING AGAIN`);
		setTimeout(fadeLabel.bind(null, "error msg", false), ERROR_DURATION_SEC * 10);
	} else {
		labels[label].opacity = 0;
		//console.log(`\tTHAT's ALL FOLKS!`);
		labels[label].visible = false;
	}
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}