function init() { 
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	thePlayerIds = [];
	initLabels();
	changeState(constants.states.INIT);
	handleResize();
}

var cursorX, cursorY;

function animate() {
	requestAnimFrame(animate);
	tick();
}

//////////  Events  \\\\\\\\\\

function getButtons() {
	return Object.values(buttons);
}

function handleMouseMove(event) {
	cursorX = event.pageX - canvas.offsetLeft;
	cursorY = event.pageY - canvas.offsetTop;
	for (var button of getButtons()) {
		if (button.under(cursorX, cursorY)) {
			if (!clickCursor) {
				$("#game-canvas").css("cursor", "pointer");
				clickCursor = true;
			}
			return;
		}
	}

	$("#game-canvas").css("cursor","auto");
	clickCursor = false;
}

function handleMouseDown(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of getButtons()) {
		button.handleMouseDown(cursorX, cursorY);
	}
}

function handleMouseUp(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of getButtons()) {
		button.handleMouseUp(cursorX, cursorY);
	}
	handleMouseMove(event);
}

var SHIFTED = false;
var ALT = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
		case 13:	// enter
			if (overlay && overlay !== OVERLAY_ACCEPT_DEMON) {
				clearOverlay();
			} else if (theTable) {
				buttons["submit chat"].click();
			} else {
				if (SHIFTED) {
					buttons["make table"].click();
				} else {
					buttons["join table"].click();
				}
			}
			break;
		case 38:    // up
			buttons["begin game"].click();
			break;
		case 39:    // ->
			if (thePlayer && thePlayer.isDemon) {
				cycleActivePlayer(true);
			} else {
				buttons["vote no"].click();
			}
			break;
		case 37:	// <-
			if (thePlayer && thePlayer.isDemon) {
				cycleActivePlayer(false);
			} else {
				buttons["vote yes"].click();
			}
			break;
		case 40:    // down
			buttons["ready"].click();
			break;
		case 16:    // shift
			SHIFTED = true;
			break;
		case 18:    // alt
			ALT = true;
			break;
		case 27: 	// esc
			if (gameState === constants.states.LOBBY) {
				buttons["leave table"].click();
			} else {
				buttons[constants.moves.PASS].click();
			}
			break;
	}
	console.log("Key press: " + event.keyCode);
}

function handleKeyUp(event) {
	switch (event.keyCode) {
		case 16:
			SHIFTED = false;
			break;
		case 18:
			ALT = false;
			break;
	}
}

var wOff;
var hOff;
function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (window.innerWidth < window.innerHeight * aspect) {
		cvW = window.innerWidth;
		cvH = window.innerWidth/ aspect;
		r = cvW / 1000;
		wOff = 0;
		hOff = (window.innerHeight - cvH) / 2;
	} else {
		cvW = window.innerHeight * aspect;
		cvH = window.innerHeight;
		r = cvH * aspect / 1000;
		wOff = (window.innerWidth - cvW) / 2;
		hOff = 0;
	}
	resizeCanvas(window.innerWidth, window.innerHeight);
	resizeElems();
}

function resizeElems() {
	// Resize input boxes
	for (var name in elems) elems[name].resize();
	
	// Resize the demon chats
	if (!theTable) return;
	var numToPossess = Math.ceil(numPlayersAtTable() / 2);
	var x = 0.15;
	var y = 0.25;
	var h = (0.85 - y) / (numToPossess > 3 ? 2 : 1);
	var w = 0.21;
	var margin = 0.005;
	var nameHeight = 0.04;
	let i = 0;
	Object.values(demonChats).forEach(chat => {
		var dx = x + (i % 3) * w + margin;
		var dy = y + h * Math.floor(i / 3) + margin + nameHeight;
		var dw = w - margin * 2;
		var dh = h - margin * 2 - nameHeight;
		chat.setPosition(dx, dy).setDims(dw, dh).resize();
		i++;
	});
}

function resizeCanvas(w, h) {
    let ratio = window.devicePixelRatio;
	canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
	canvas.style.height = h + "px";
    canvas.getContext("2d").scale(ratio, ratio);
}

//////////  Drawing  \\\\\\\\\\

function tick() {	
	if (IMAGES[BACK].loaded) {
		ctx.drawImage(IMAGES[BACK].img, 0, 0, window.innerWidth, window.innerHeight);
	} else {
		drawRect(BACKGROUND_COLOR, 0, 0, window.innerWidth,	window.innerHeight, true);
	}

	// Check for holding buttons.
	for (var button of getButtons()) button.checkHold(cursorX, cursorY);

	if (isTableOwner()) {
		buttons["table code"].enable();
	} else {
		buttons["table code"].disable().show();
	}
	switch(gameState) {
		case constants.states.INIT:
			drawGroups["main menu"].draw();
			labels["disconnected"].draw();
			drawGroups["bottom bar"].draw();
			break;
		case constants.states.MAIN_MENU:
			drawGroups["main menu"].draw();
			drawGroups["bottom bar"].draw();
			break;
		case constants.states.LOBBY:
			drawGroups["chat"].draw();
			drawTable();
			if (isTableOwner()) {
				if (theTable.players.length >= theTable.settings.minPlayers) {
					buttons["begin game"].enable();
				} else {
					buttons["begin game"].disable().show();
				}
				buttons["table settings"].enable();
			} else {
				buttons["begin game"].disable();
				buttons["table settings"].disable();
			}
			drawGroups["table lobby"].draw();
			drawGroups["bottom bar"].draw();
			break;
		default:
			drawGroups["chat"].draw();
			if (thePlayer.isDemon) {
				drawDemonView();
			} else {
				drawPlayerView();
			}
			drawTimers();
			drawGroups["bottom bar"].draw();
			break;
	}

	switch (overlay) {
		case OVERLAY_POPUP:
			drawPopUp();
			break;
		case OVERLAY_HOWTO:
			drawHowTo();
			break;
		case OVERLAY_AVATAR:
			drawAvatarSelection();
			break;
		case OVERLAY_ACCEPT_DEMON:
			drawDemonAccept();
			break;
		case OVERLAY_SETTINGS:
			drawSettings();
			break;
	}
}

function drawPlayerView() {
	drawTable();

	switch (gameState) {
		case constants.states.DEMON_SELECTION:
			break;
		case constants.states.NIGHT:
			break;
		case constants.states.DISCUSS:
			buttons["ready"].draw();
			break;
		case constants.states.DAY:
			break;
		case constants.states.SECONDING:
		case constants.states.VOTING:
			labels[theTable.currentMove.type].draw();
			if (thePlayer.isExorcised) {
				drawGroups["voting"].disable();
			} else {
				drawGroups["voting"].draw();
			}
			break;
		case constants.states.SELECT:
			labels[theTable.currentMove.type].draw();
			break;
		case constants.states.DISPLAY:
			if (theTable.currentMove && ![constants.moves.PASS, constants.items.SALT].includes(theTable.currentMove.type)) labels[theTable.currentMove.type].draw();
			break;
		case constants.states.INTERFERE:
			labels[theTable.currentMove.type].draw();
			break;
		case constants.states.INTERPRET:
			labels[constants.items.ROD].draw();
			drawGroups["rod"].draw();
			break;
		case constants.states.END:
			if (isTableOwner()) {
				buttons["finish game"].enable();
				buttons["finish game"].draw();
			}
			break;
	}
}

function drawDemonView() {
	drawDemonControlPanel();
	switch (gameState) {
		case constants.states.NIGHT:
			break;
		case constants.states.DISCUSS:
			break;
		case constants.states.DAY:
			break;
		case constants.states.SECONDING:
		case constants.states.VOTING:
			break;
		case constants.states.SELECT:
			break;
		case constants.states.DISPLAY:
			break;
		case constants.states.INTERFERE:
			break;
		case constants.states.END:
			break;
	}
}

window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		   window.webkitRequestAnimationFrame ||
		   window.mozRequestAnimationFrame ||
		   window.oRequestAnimationFrame ||
		   window.msRequestAnimationFrame ||
		   function (callback, element) {
			   window.setTimeout(callback, 1000 / 30);
		   };
})();

// TODO: move most of this to constant
var canvas, ctx, cvW, cvH;
var clickCursor = false,
	aspect = 16 / 10,
	BACKGROUND_COLOR = "#222222",
	LABEL_FONT = "Tahoma",
	WHITE = "#ffffff",
	BUTTON_BACKGROUND = "#810000",
	BUTTON_BORDER = "#5c0000",
	BUTTON_TEXT = "#ffffff",
	BUTTON_DISABLED = "gray";

init();
animate();

window.addEventListener("resize", handleResize, false);
window.addEventListener("mousemove", handleMouseMove, false);
window.addEventListener("mousedown", handleMouseDown, false);
window.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);