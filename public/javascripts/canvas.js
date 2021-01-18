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
			if (overlay) {
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
	if (button.isEnabled()) {
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
	for (var button of getButtons()) button.checkHold();

	buttons["howto"].draw();
	if (gameState !== MAIN_MENU) buttons["submit chat"].draw();

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
			buttons["change avatar"].draw();
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
			drawGroups["items"].draw();
			break;
		case TABLE_SECONDING:
		case TABLE_VOTING:
			drawTable();
			labels[theTable.currentMove.type].draw();
			if (thePlayer.isExorcised) {
				drawGroups["voting"].disable();
			} else {
				drawGroups["voting"].draw();
			}
			break;
		case TABLE_SELECT:
			drawTable();
			labels[theTable.currentMove.type].draw();
			break;
		case TABLE_DISPLAY:
			drawTable();
			if (theTable.currentMove.type !== PASS) labels[theTable.currentMove.type].draw();
			break;
		case TABLE_INTERFERE:
			drawTable();
			labels[BOARD].draw();
			if (thePlayer.isDemon) drawGroups["interfere"].draw();
			break;
		case TABLE_END:
			drawTable();
			if (isTableOwner()) {
				buttons["finish game"].enable();
				buttons["finish game"].draw();
			}
			break;
	}

	// Demon specific
	if (![MAIN_MENU, TABLE_LOBBY].includes(gameState) && thePlayer && thePlayer.isDemon) {
		labels["interfere uses"].draw();
		if (selectedPlayer) {
			drawCircle(getSelectedPlayer().color, 0.585 * canvas.width, 0.675 * canvas.height, 0.01 * canvas.width);
		}
	}

	// Overlays
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
	}

	drawGroups["bottom bar"].draw();
}

////// Overlays \\\\\\\\

function drawHowTo() {
	overlayed = true;

	var x = 0.01 * canvas.width;
	var y = 0.03 * canvas.height;
	var w = 0.98 * canvas.width;
	var h = 0.92 * canvas.height;
	drawRect("#333333", x, y, w, h, true);


	switch(howtoPage) {
		case 0:
			drawText("POSSESSION", 0.5, 0.1, 30);
			var intro = [
				"Possession is a game of social deduction pitting a one player (the demon) against the rest of the players (the humans).",
				"    Each round consists of two phases: first a night phase and then a day phase.",
				"    Each night, the demon possesses one human who is not already possessed, recruiting them to the demon's team.",
				"    Each day, the human players try to identify and liberate the possessed players using various tools (see next page).",
				"    Meanwhile the demon communicates with each possessed player by sending individual, one-way messages.",
				"",
				"",
				"The goal of the demon is to possess half of the humans, the goal of the humans is to liberate all of the humans.",
				"    If half of the human players are possessed at the *end* of a round, the demon and the possessed players win.",
				"    If all of the humans are liberated, the demon *and* the humans that were freed in the last round (the damned) lose.", 
				"    Human players who are possessed may choose to cooperate with the demon or not, but be careful not to be freed in the last round!",
				"",
				"",
				"During the day phase each human player may propose to use one tool that is still available in the round.",
				"    Once proposed, another player must second the proposal. If seconded, all human players will vote on whether to allow the use.",
				"    If half the humans or more vote yes (a tie succeeds), the proposing player then selects a target to use the tool on.",
				"    The player may declare their intended target during proposal and voting, but they may select whoever they want, except themself."
			];
			drawRect("#575757", 0.03, 0.13, 0.94, 0.24);
			drawRect("#575757", 0.03, 0.64, 0.94, 0.24);
			for (var i = 0; i < intro.length; i++) {
				drawText(intro[i], 0.05, 0.17 + i * 0.04, 15, "left");
			}
			break;
		case 1:
			drawText("Tools of the Trade", 0.5, 0.1, 30);

			var imageX = 0.075;
			var imageY = 0.25;
			var imageInc = 0.17;
			var imageSize = 0.05;
			var textX = 0.125;
			var textY = 0.2;
			var textInc = 0.03;
			var textSize = 15;

			var imageDesc = {
				BOARD: [
					"Spirit Board: a player uses the spirit board to ask if another player is currently possessed.",
					"    Players may consult the spirit board once per round. The answer is displayed to all players.",
					"    The demon may interfere with the spirit board a limited number of times, making it give the wrong answer.",
					"    The demon starts with one chance to interfere, and gains one use every time an exorcism is performed.",
				],
				ROD: [
					"Divining Rod: a player uses the diving rod to determine if another player is currently possessed.",
					"    Players may use the divining rod once per round. Only the user of the rod is told the answer.",
				],
				WATER: [
					"Holy Water: a player uses one vial of holy water to free another player from possession.",
					"    Players gain one vial of holy water per round, unused vials accumulate across rounds.",
				],
				EXORCISM: [
					"Cross: a player uses the cross to perform an exorcism on another player, freeing them from possession.",
					"    Players may perform one exorcism per round. The target player is knocked unconscious of the next round,",
					"    unable to speak or vote (they are not counted in vote ratio).  Performing an exorcism gives the demon a ",
					"    window into the world, granting them one additional chance to interfere with the Spirit Board.",
				],
			};
			var items = [BOARD, ROD, WATER, EXORCISM];

			for (var item of items) {
				if (Math.round(imageY * 100) % 2 == 1)
					drawRect("#575757", imageX - imageSize, imageY - imageSize * 1.6, 0.95, imageSize * 3.2);
				var l = new ImageLabel({x: imageX, y: imageY}, imageSize, false, ITEM_IMAGES[item], true);
				l.draw();
				textY = imageY - 0.04;
				imageY += imageInc;
				for (var desc of imageDesc[item]) {
					drawText(desc, textX, textY, textSize, "left");
					textY += textInc;
				}
			}
			break;
	}
	drawGroups["howto"].enable();
	if (howtoPage === 0) {
		buttons["howto <"].disable();
	} else if (howtoPage === HOW_TO_PAGES - 1) {
		buttons["howto >"].disable();
	}
	drawGroups["howto"].draw();
}

function drawAvatarSelection() {
	overlayed = true;

	var x = 0.01 * canvas.width;
	var y = 0.03 * canvas.height;
	var w = 0.98 * canvas.width;
	var h = 0.92 * canvas.height;
	drawRect("#333333", x, y, w, h, true);

	var gapWidth = 0.0067 * canvas.width;
	var boxWidth = 0.09 * canvas.width;
	var boxHeight = boxWidth / PLAYER_IMAGES[0].ratio;

	drawGroups["avatar selection"].enable();

	// Draw avatars
	const perRow = 10;
	for (var i = 0; i < AVATAR_COUNT; i++) {
		var row = i % perRow;
		var col = Math.floor(i / perRow);
		if (i === thePlayer.avatarId) {
			drawCircle(thePlayer.color, x + gapWidth * (row + 1) + boxWidth * (row + 0.5), y + gapWidth * (col + 1) + boxHeight * (col + 0.5), boxWidth / 2, true);
		}
		buttons[`avatar ${i}`].position = {x: x + gapWidth * (row + 1) + boxWidth * row, y: y + gapWidth * (col + 1) + boxHeight * col};
		buttons[`avatar ${i}`].width = boxWidth / canvas.width;
		buttons[`avatar ${i}`].draw();
	}

	var gapWidth = 0.005 * canvas.width;
	var boxWidth = 0.06 * canvas.width;
	for (var i = 0; i < 14; i ++) {
		var color = PLAYER_COLORS[i];
		var boxX = x + gapWidth * (i + 1) + boxWidth * i;
		var boxY = y + 0.8 * canvas.height;
		drawColorSelector(color, boxX, boxY, boxWidth, boxWidth);
	}

	buttons["clear avatar"].enable();
	buttons["clear avatar"].draw();
}

function drawColorSelector(color, x, y, w, h) {
	if (color === thePlayer.color) {
		drawRect("gray", x - 2, y - 2, w + 4, h + 4, true);
	}
	buttons[`color ${color}`].position = {x: x, y: y};
	buttons[`color ${color}`].width = w / canvas.width;
	buttons[`color ${color}`].height = h / canvas.height;
	buttons[`color ${color}`].draw();
	if (theTable.playerColors.includes(color)) {
		buttons[`color ${color}`].disable();
		buttons[`color ${color}`].show();
		if (color !== thePlayer.color) ctx.drawImage(FAIL_X_IMAGE.img, x, y, w, h);
	}
}

function drawPopUp() {
	overlayed = true;
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

////// Main game \\\\\\\\

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

function drawPlayers() {
	var padRad = 0.04 * canvas.width;
	var tableRad = labels["table_img"].dims().width / 2 + padRad * 1.25;
	var tableX = labels["table_img"].position.x * canvas.width;
	var tableY = labels["table_img"].position.y * canvas.height;
	var angle = 180; 
	var delta = 360 / (theTable.players.length - ([TABLE_LOBBY, TABLE_END].includes(gameState) ? 0 : 1));
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
	if (player.isDamned || (thePlayer.isDemon && possessedPlayers.includes(player.name)) || (thePlayer.name === player.name && thePlayerIsPossessed)) {
		var pent = new ImageLabel({x: x, y: y}, r * 2.5 / canvas.width, false, PENTAGRAM_IMAGE, true, true);
		pent.draw();
	}
	drawCircle(player.color, x, y, r);
	// Move player avatar/button to position.
	buttons[player.name].position = {x: x - r * 0.25, y: y - r * 0.18};
	buttons[player.name].width = r * 1.6 / canvas.width;
	buttons[player.name].img = PLAYER_IMAGES[player.avatarId];
	// Enable button for the demon, and for player selecting another player for a move.
	buttons[player.name].enabled = thePlayer.isDemon || gameState === TABLE_SELECT && theTable.currentMove.playerName === thePlayer.name && player.name !== thePlayer.name;
	buttons[player.name].visible = true;
	buttons[player.name].draw();
	if (player.isExorcised) {
		var cross = new ImageLabel({x: x - r * 0.25, y: y - r * 0.25}, false, r * 1.2 / canvas.height, ITEM_IMAGES[EXORCISM], true, true);
		cross.draw();
	}
	// Draw name
	var plate = new ImageLabel({x: x, y: y + r * 0.7}, r * 2 / canvas.width, false, NAMEPLATE_IMAGE, true, true);
	plate.draw();
	var name = new Label({x: x, y: y + r * 0.85}, player.name, 15, false, false, "black");
	scaleLabelsToWidth([name], r * 2, 5);
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

///// Drawing utilities \\\\\\\

function drawText(text, x, y, size, align) {
	var l = new Label({x: x, y: y}, text, size, align);
	l.draw();
}

function drawImage(image, x, y, w, h, center, absolute) {
	var l = new ImageLabel({x: x, y: y}, w, h, image, center, absolute);
	l.draw();
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

function scaleLabelsToWidth(labels, width, margin) {
	var totalMargin = margin * (2 + labels.length - 1);
	var totalWidth = totalMargin;
	for (var label of labels) {
		totalWidth += label.dims().width;
	}
	var scale = (width - totalMargin) / totalWidth;
	for (var label of labels) {
		label.size = Math.min(label.size * scale, label.maxSize);
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
		w: 0.32,
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