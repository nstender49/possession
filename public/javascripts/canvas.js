// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.

//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	initInputs();
	initLabels();

	changeState(INIT);
	
	handleResize();
}

var cursorX, cursorY;

function animate() {
	requestAnimFrame(animate);
	draw();
}

//////////  Events  \\\\\\\\\\

function getButtons() {
	return Object.values(buttons);
}

function handleMouseMove(event) {
	cursorX = event.pageX - canvas.offsetLeft;
	cursorY = event.pageY - canvas.offsetTop;
	for (var button of getButtons()) {
		if (isOnButton(button)) {
			if (!clickCursor) {
				$("#game-canvas").css("cursor", "pointer");
				clickCursor = true;
			}
			button.focus = true;
			return;
		} else {
			button.down = false;
			button.focus = false;
		}
	}

	$("#game-canvas").css("cursor","auto");
	clickCursor = false;
}

function handleMouseDown(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of getButtons()) {
		if (isOnButton(button)) {
			button.down = true;
			return;
		}
	}
}

function handleMouseUp(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	for (var button of getButtons()) {
		if (button.down) {
			button.toggle();
		}
		button.down = false;
	}
	handleMouseMove(event);
}

var SHIFTED = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
		case 9:
			if (thePlayer && thePlayer.isDemon) {
				cycleActivePlayer();
			}
			break;
		case 13:	// enter
			if (theTable) {
				buttons["submit chat"].click();
			} else {
				if (SHIFTED) {
					buttons["make table"].click();
				} else {
					buttons["join table"].click();
				}
			}
			break;
		case 49:
			buttons[WATER].click();
			break;
		case 50:
			buttons[BOARD].click();
			break;
		case 51:
			buttons[ROD].click();
			break;
		case 52:
			buttons[EXORCISM].click();
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
		case 16:    // shift
			SHIFTED = true;
			break;
		case 27: 	// esc
			if (gameState === TABLE_LOBBY) {
				buttons["leave table"].click();
			} else {
				buttons[PASS].click();
			}
			break;
	}
	// console.log("Key press: " + event.keyCode);
}

function handleKeyUp(event) {
	switch (event.keyCode) {
		case 16:
			SHIFTED = false;
			break;
	}
}

function isOnButton(button) {
	if (button.enabled) {
		buttonDims = button.buttonDims();
		return cursorX >= buttonDims.left && cursorX <= buttonDims.right && cursorY <= buttonDims.bot && cursorY >= buttonDims.top;
	}
	return false;
}

function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (window.innerWidth < window.innerHeight * aspect) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerWidth/ aspect;
		r = canvas.width / 1000;
	} else {
		canvas.width = window.innerHeight * aspect;
		canvas.height = window.innerHeight;
 		r = canvas.height * aspect / 1000;
	}
	// Resize input boxes
	for (var config of ELEM_CONFIGS) {
		var elem = document.getElementById(config.name);
		elem.style.position = "absolute";
		elem.style.left = (canvas.getBoundingClientRect().left + canvas.width * config.x) + "px";
		elem.style.top = (canvas.getBoundingClientRect().top + canvas.height * config.y) + "px";
		if (config.w) {
			elem.style.width = (canvas.width * config.w) + "px";
			elem.style.height = (canvas.height * config.h) + "px";
		}
		if (config.size) {
			elem.style.fontSize = (config.size * r) + "px";
		}

	}
	if (DEBUG) {
		document.getElementById("player-name").value = "P" + Math.floor(Math.random() * 100);
		document.getElementById("game-code").value = "AAAA";
	}
}

//////////  Drawing  \\\\\\\\\\

function draw() {
	drawRect(BACKGROUND_COLOR, 0, 0, 1, 1);

	// Check for holding buttons.
	for (var button of getButtons()) {
		button.checkHold();
	}

	if (gameState !== MAIN_MENU) {
		buttons["submit chat"].draw();
		
		// Draw demon selection indicator
		if (gameState !== TABLE_LOBBY && selectedPlayer) {
			drawCircle(getSelectedPlayer().color, 0.58 * canvas.width, 0.678 * canvas.height, 0.012 * canvas.width);
		}
	}

	switch (gameState) {
		case INIT:
			break;
		case MAIN_MENU:
			drawGroups["main menu"].draw();
			break;
		case TABLE_LOBBY:
			if (theTable.players.length >= theTable.settings.minPlayers && isTableOwner()) {
				labels["message"].text = "Press Begin to start game!";
			}
			drawTable();
			if (theTable.players.length >= theTable.settings.minPlayers && isTableOwner()) {
				buttons["begin game"].enable();
				buttons["begin game"].draw();
			}
			buttons["leave table"].draw();
			break;
		case TABLE_NIGHT:
			drawTable();
			break;
		case TABLE_DAY:
			drawTable();
			// Draw buttons
			if (thePlayer.move) {
				drawGroups["items"].disable();
				drawGroups["items"].show();
			}
			labels["water_count"].text = `${theTable.resources.WATER} x`;
			labels["board_count"].text = `${theTable.resources.BOARD} x`;
			labels["rod_count"].text = `${theTable.resources.ROD} x`;
			labels["exorcism_count"].text = `${theTable.resources.EXORCISM} x`;
			drawGroups["items"].draw();
			break;
		case TABLE_SECONDING:
		case TABLE_VOTING:
			drawTable();
			labels[theTable.currentMove.type].draw();
			drawGroups["voting"].draw();
			break;
		case TABLE_SELECT:
			drawTable();
			labels[theTable.currentMove.type].draw();
			break;
		case TABLE_DISPLAY:
			drawTable();
			switch(theTable.currentMove.type) {
				case WATER:
				case ROD:
				case EXORCISM:
				case BOARD:
					labels[theTable.currentMove.type].draw();
					break;
			}
			break;
		case TABLE_INTERFERE:
			drawTable();
			labels[BOARD].draw();
			if (thePlayer.isDemon) {
				if (interfereUses === 0) {
					drawGroups["interfere"].disable();
				}
				drawGroups["interfere"].draw();
			}
	} 
	if (thePlayer && thePlayer.isDemon) {
		labels["interfere uses"].draw();
	}
	if (popupMessage) {
		drawPopUp();
	}
	draw
	drawGroups["bottom bar"].draw();
}

function drawPopUp() {
	var x = 0.15 * canvas.width;
	var y = 0.4 * canvas.height;
	var w = 0.3 * canvas.width;
	var h = 0.18 * canvas.height;
	drawRect("#333333", x, y, w, h, true);
	drawRect("#810000", x + 10, y + 10, w - 20, h - 20, true);
	var msg = new Label({x: 0.3, y: 0.46}, popupMessage, 20);
	scaleLabelsToWidth([msg], w - 30, 10);
	msg.draw();
	buttons["clear popup"].enable();
	buttons["clear popup"].draw();
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) {
		return;
	}

	// Draw table
	labels["table_img"].draw();
	scaleLabelsToWidth([labels["message"]], labels["table_img"].dims().width * 0.9, 10);
	labels["message"].draw();

	// Draw players
	drawPlayers();
}

function drawRect(color, x, y, w, h, absolute=false) {
	var x = x * (absolute ? 1 : canvas.width);
	var y = y * (absolute ? 1 : canvas.height);
	var w = w * (absolute ? 1 : canvas.width);
	var h = h * (absolute ? 1 : canvas.height);
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
}

function drawCircle(color, x, y, r) {
	ctx.fillStyle = color;
	ctx.lineWidth = 0.1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.stroke();
}

function drawPlayers() {
	var padRad = 0.04 * canvas.width;
	var tableRad = labels["table_img"].dims().width / 2 + padRad * 1.25;
	var tableX = labels["table_img"].position.x * canvas.width;
	var tableY = labels["table_img"].position.y * canvas.height;
	var angle = 180; 
	var delta = 360 / (theTable.players.length - (gameState === TABLE_LOBBY ? 0 : 1));
	playerButtons = [];
	for (var player of theTable.players) {
		if (player.isDemon) continue;
		var rad = Math.PI * angle / 180;
		var x = tableX - Math.sin(rad) * tableRad;
		var y = tableY + Math.cos(rad) * tableRad;
		drawPlayerPad(player, x, y, padRad);
		angle = (angle + delta) % 360;
	}
}

function drawPlayerPad(player, x, y, r) {
	// Draw pentagram under the player pad if player is possessed for player and demon.
	if ((thePlayer.isDemon && possessedPlayers.includes(player.name)) || (thePlayer.name === player.name && thePlayerIsPossessed)) {
		var pent = new ImageLabel({x: x, y: y}, r * 2.5 / canvas.width, false, PENTAGRAM_IMAGE, true, true);
		pent.draw();
	}
	drawCircle(player.color, x, y, r);
	// Move player avatar/button to position.
	buttons[player.name].position = {x: x - r * 0.25, y: y - r * 0.25};
	buttons[player.name].width = r / canvas.width;
	// Enable button for the demon, and for player selecting another player for a move.
	buttons[player.name].enabled = thePlayer.isDemon || gameState === TABLE_SELECT && theTable.currentMove.playerName === thePlayer.name && player.name !== thePlayer.name;
	buttons[player.name].visible = true;
	buttons[player.name].draw();
	if (player.isExorcised) {
		var move = new ImageLabel({x: x - r * 0.25, y: y - r * 0.25}, false, r * 1.2 / canvas.height, ITEM_IMAGES[EXORCISM], true, true);
		move.draw();
	}
	// Draw name
	var name = new Label({x: x, y: y + r * 0.75}, player.name, 15, false, false, "black");
	scaleLabelsToWidth([name], r * 1.5, 10);
	name.draw(true);
	// Draw player's move
	if (player.move) {
		var move = new ImageLabel({x: x + r * 0.5, y: y - r * 0.4}, false, r * 0.7 / canvas.height, ITEM_IMAGES[player.move.type], true, true);
		move.draw();
		if (player.move.success === false) {
			var fail = new ImageLabel({x: x + r * 0.5, y: y - r * 0.4}, false, r * 0.6 / canvas.height, FAIL_X_IMAGE, true, true);
			fail.draw();
		}
	}
	// Draw player vote indicator
	if (player.voted) {
		var image = player.vote === undefined ? VOTED_IMAGE : (player.vote ? YES_VOTE_IMAGE : NO_VOTE_IMAGE);
		var voted = new ImageLabel({x: x + r * 0.5, y: y + r * 0.2}, false, r * 0.7 / canvas.height, image, true, true);
		voted.draw();
	}
}

function scaleLabelsToWidth(labels, width, margin) {
	var totalMargin = margin * (2 + labels.length - 1);
	var totalWidth = totalMargin;
	for (var label of labels) {
		totalWidth += label.dims().width;
	}
	var scale = (width - totalMargin) / totalWidth;
	for (var label of labels) {
		label.size *= scale;
	}
}

function sound(src) {
	this.sound = document.createElement("audio");
	this.sound.src = src;
	this.sound.setAttribute("preload", "auto");
	this.sound.setAttribute("controls", "none");
	this.sound.style.display = "none";
	document.body.appendChild(this.sound);
	this.play = function(){
		if (soundEnabled) {
			this.sound.play();
		}
	}
	this.stop = function(){
		this.sound.pause();
	}
}

//////////  Initialize  \\\\\\\\\\

function initInputs() {
	var container = document.getElementById("content");
	var input = document.createElement("input");
	input.id = "player-name";
	input.type = "text";
	input.maxLength = 16;
	input.placeholder = "Player Name";
	input.style.display = "none";
	container.appendChild(input);

	input = document.createElement("input");
	input.id = "game-code";
	input.type = "text";
	input.maxLength = 4;
	input.placeholder = "CODE";
	input.style.textTransform = "uppercase";
	input.style.display = "none";
	container.appendChild(input);

	input = document.createElement("input");
	input.id = "chat-input";
	input.type = "text";
	input.autocomplete = "off";
	input.style.display = "none";
	container.appendChild(input);

	input = document.createElement("ul");
	input.id = "player-chat";
	input.type = "ul";
	input.style.display = "none";
	container.appendChild(input);

	input = document.createElement("ul");
	input.id = "demon-chat";
	input.type = "ul";
	input.style.display = "none";
	container.appendChild(input);
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

var hand, canvas, ctx;
var clickCursor = false,
	aspect = 16 / 10,
	ERROR_DURATION_SEC = 2.5,
	BACKGROUND_COLOR = "black",
	LABEL_FONT = "Tahoma",
	FELT_COLOR = "#35654d",
	LEDGER_COLOR = "#FDFD96",
	RED = "red",
	WHITE = "white";

var VERSION = "v0.1.2";
var ELEM_CONFIGS = [
	{
		name: "player-name",
		x: 0.288,
		y: 0.63,
		w: 0.3,
		h: 0.09,
		size: 40,
	},
	{
		name: "game-code",
		x: 0.594,
		y: 0.63,
		w: 0.12,
		h: 0.09,
		size: 40,
	},
	{
		name: "player-chat",
		x: 0.6,
		y: 0.05,
		w: 0.35,
		h: 0.6,
		size: 15,
	},
	{
		name: "chat-input",
		x: 0.6,
		y: 0.65,
		w: 0.315,
		h: 0.05,
		size: 15,
	},
	{
		name: "demon-chat",
		x: 0.6,
		y: 0.7,
		w: 0.35,
		h: 0.25,
		size: 15,
	}
];

init();
animate();

window.addEventListener("resize", handleResize, false);
canvas.addEventListener("mousemove", handleMouseMove, false);
canvas.addEventListener("mousedown", handleMouseDown, false);
canvas.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);