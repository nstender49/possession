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
	for (var name in ELEM_CONFIGS) {
		var config = ELEM_CONFIGS[name];
		var elem = document.getElementById(name);
		elem.style.position = "absolute";
		elem.style.left = (canvas.getBoundingClientRect().left + wOff + cvW * config.x) + "px";
		elem.style.top = (canvas.getBoundingClientRect().top + hOff + cvH * config.y) + "px";
		if (config.w) {
			elem.style.width = (cvW * config.w) + "px";
			elem.style.height = (cvH * config.h) + "px";
		}
		if (config.size) {
			elem.style.fontSize = (config.size * r) + "px";
		}
	}

	// Autofill debug fields
	if (DEBUG) {
		document.getElementById("player-name").value = "Player" + Math.floor(Math.random() * 100);
		document.getElementById("game-code").value = "AAAA";
	}

	// Resize the demon chats
	if (!theTable) return;

	var numToPossess = Math.ceil((theTable.players.length - 1) / 2);
	var x = 0.15;
	var y = 0.25;
	var h = (0.85 - y) / (numToPossess > 3 ? 2 : 1);
	var w = 0.21;
	var margin = 0.005;
	var nameHeight = 0.04;
	for (i = 0; i < demonChats.length; i++) {
		var dx = x + (i % 3) * w + margin;
		var dy = y + h * Math.floor(i / 3) + margin + nameHeight;
		var dw = w - margin * 2;
		var dh = h - margin * 2 - nameHeight;
		var elem = demonChats[i];
		elem.style.position = "absolute";
		elem.style.left = (canvas.getBoundingClientRect().left + cvW * dx + wOff) + "px";
		elem.style.top = (canvas.getBoundingClientRect().top + cvH * dy + hOff) + "px";
		elem.style.width = (cvW * dw) + "px";
		elem.style.height = (cvH * dh) + "px";
		elem.style.fontSize = (10 * r) + "px";
	}
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

function drawTimers() {
	if (!theTable) return;
	// Update timers
	for (var timer in theTable.timers) {
		if (theTable.timers[timer] && theTable.timers[timer] >= ts.now()) {
			labels[timer].text = formatSec(Math.floor((theTable.timers[timer] - ts.now()) / 1000));
			drawGroups[timer].enable();
		} else {
			drawGroups[timer].disable();
		}
	}
	drawGroups["timers"].draw();
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
			drawTableItems();
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

////// Overlays \\\\\\\\

function drawHowTo() {
	overlayed = true;

	drawRect("#333333", 0.01, 0.03, 0.98, 0.92);

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
				"    If half of the human players are possessed at the end of a round, the demon and the possessed players win.",
				"    If all of the humans are liberated, the demon and the humans that were freed in the last round (the damned) lose.", 
				"    Human players who are possessed may choose to cooperate with the demon or not, but be careful not to be freed in the last round!",
				"",
				"",
				"During the day phase each human player may propose to use one tool that is still available in the round.",
				"    Once proposed, another player must second the proposal. If seconded, all human players will vote on whether to allow the use.",
				"    If half the humans or more vote yes (a tie succeeds), the proposing player then selects a target to use the tool on.",
				"    The player may declare their intended target during proposal and voting, but they may select whoever they want, except themself."
			];
			drawRect("#575757", 0.03, 0.13, 0.94, 0.24);
			drawRect("#575757", 0.03, 0.64, 0.94, 0.2);
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
				[constants.items.BOARD]: [
					"Spirit Board: a player uses the spirit board to ask if another player is currently possessed.",
					"    Players may consult the spirit board once per round. The answer is displayed to all players.",
					"    The demon may interfere with the spirit board a limited number of times, making it give the wrong answer.",
					"    The demon starts with one chance to interfere, and gains one use every time an exorcism is performed.",
				],
				[constants.items.ROD]: [
					"Divining Rod: a player uses the diving rod to determine if another player is currently possessed.",
					"    Players may use the divining rod once per round. Only the user of the rod is told the answer.",
				],
				[constants.items.WATER]: [
					"Holy Water: a player uses one vial of holy water to free another player from possession.",
					"    Players gain one vial of holy water per round, unused vials accumulate across rounds.",
				],
				[constants.items.EXORCISM]: [
					"Cross: a player uses the cross to perform an exorcism on another player, freeing them from possession.",
					"    Players may perform one exorcism per round. The target player is knocked unconscious until the next round,",
					"    unable to speak or vote (they are not counted in vote ratio).  Performing an exorcism gives the demon a ",
					"    window into the world, granting them one additional chance to interfere with the Spirit Board.",
				],
			};
			var items = [constants.items.BOARD, constants.items.ROD, constants.items.WATER, constants.items.EXORCISM];

			for (var item of items) {
				if (Math.round(imageY * 100) % 2 == 1)
					drawRect("#575757", imageX - imageSize, imageY - imageSize * 1.6, 0.95, imageSize * 3.2);
				var l = new ImageLabel(IMAGES[item]).setPosition(imageX, imageY).setDims(imageSize).setCenter(true);
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

function drawSettings() {
	overlayed = true;

	drawRect("#333333", 0.01, 0.01, 0.98, 0.93);

	// Main settings
	drawRect("#666666", 0.03, 0.03, 0.94, 0.2);
	var dx = 0.16;
	var dy = 0.07;
	drawText("Turn Order", dx, dy + 0.01, 20, "right");
	buttons[`enable order`].setPosition(dx + 0.05, dy);
	buttons[`disable order`].setPosition(dx + 0.09, dy);

	dy += 0.06;
	drawText("Water Purify", dx, dy + 0.01, 20, "right");
	buttons[`enable purify`].setPosition(dx + 0.05, dy);
	buttons[`disable purify`].setPosition(dx + 0.09, dy);

	var dx = 0.5;
	var dy = 0.07;
	drawText("Min Players", dx, dy + 0.01, 20, "right");
	buttons["decrease MIN_PLAYERS"].setPosition(dx + 0.05, dy);
	drawText(theTable.settings.minPlayers, dx + 0.09, dy + 0.01, 20);
	buttons["increase MIN_PLAYERS"].setPosition(dx + 0.13, dy);

	dy += 0.06;
	drawText("Max Players", dx, dy + 0.01, 20, "right");
	buttons["decrease MAX_PLAYERS"].setPosition(dx + 0.05, dy);
	drawText(theTable.settings.maxPlayers, dx + 0.09, dy + 0.01, 20);
	buttons["increase MAX_PLAYERS"].setPosition(dx + 0.13, dy);

	// Items
	drawRect("#666666", 0.03, 0.25, 0.46, 0.6);
	const ITEMS = Object.values(constants.items);
	var half = Math.ceil(Object.keys(constants.items).length / 2);
	var itemHeight = (0.6 * 0.8) / half;
	var margin = (0.6 - itemHeight * half) / (half + 1);
	for (var i = 0; i < ITEMS.length; i++) {
		var row = Math.floor(i / 2);
		var col = i % 2;
		var dx = 0.05 + 0.22 * col;
		var dy = 0.25 + margin * (row + 1) + itemHeight * row;
		drawImage(IMAGES[ITEMS[i]], dx, dy, false, itemHeight);
		buttons[`enable ${ITEMS[i]}`].setPosition(dx + 0.14, dy + itemHeight / 2);
		buttons[`disable ${ITEMS[i]}`].setPosition(dx + 0.18, dy + itemHeight / 2);
	}

	// Timers
	drawRect("#666666", 0.51, 0.25, 0.46, 0.6);
	var margin = 0.07;
	var dy = 0.24;
	for (var setting in INC_SETTINGS) {
		if (["MIN_PLAYERS", "MAX_PLAYERS"].includes(setting)) continue;
		dy += margin;
		drawText(title(setting), 0.6, dy + 0.01, 15, "right");
		buttons[`decrease ${setting}`].setPosition(0.65, dy);
		drawText(formatSec(theTable.settings.times[setting]), 0.7, dy + 0.01, 15);
		buttons[`increase ${setting}`].setPosition(0.75, dy);
	}

	drawGroups["settings"].draw();
}

function title(s) {
	return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
}

function drawAvatarSelection() {
	overlayed = true;

	var x = 0.01 * cvW + wOff;
	var y = 0.03 * cvH + hOff;
	var w = 0.98 * cvW;
	var h = 0.92 * cvH;
	drawRect("#333333", x, y, w, h, true);

	var gapWidth = 0.0067 * cvW;
	var boxWidth = 0.09 * cvW;
	var boxHeight = boxWidth / PLAYER_IMAGES[0].ratio;

	drawGroups["avatar selection"].enable();

	// Draw avatars
	const perRow = 10;
	for (var i = 0; i < constants.AVATAR_COUNT; i++) {
		var row = i % perRow;
		var col = Math.floor(i / perRow);
		if (i === thePlayer.avatarId) {
			drawCircle(thePlayer.color, x + gapWidth * (row + 1) + boxWidth * (row + 0.5), y + gapWidth * (col + 1) + boxHeight * (col + 0.5), boxWidth / 2, true);
		}
		buttons[`avatar ${i}`].setPosition(x + gapWidth * (row + 1) + boxWidth * row, y + gapWidth * (col + 1) + boxHeight * col);
		buttons[`avatar ${i}`].width = boxWidth / cvW;
		buttons[`avatar ${i}`].draw();
	}

	var gapWidth = 0.005 * cvW;
	var boxWidth = 0.06 * cvW;
	for (var i = 0; i < constants.PLAYER_COLORS.length; i ++) {
		var color = constants.PLAYER_COLORS[i];
		var boxX = x + gapWidth * (i + 1) + boxWidth * i;
		var boxY = y + 0.8 * cvH;
		drawColorSelector(color, boxX, boxY, boxWidth, boxWidth);
	}

	buttons["clear avatar"].enable().draw();
}

function drawColorSelector(color, x, y, w, h) {
	if (color === thePlayer.color) {
		var margin = 2 * r;
		drawRect("gray", x - margin, y - margin, w + margin * 2, h + margin * 2, true);
	}
	buttons[`color ${color}`].setPosition(x, y);
	buttons[`color ${color}`].width = w / cvW;
	buttons[`color ${color}`].height = h / cvH;
	buttons[`color ${color}`].draw();
	const tableColors = theTable.players.map(p => p.color);
	if (tableColors.includes(color)) {
		buttons[`color ${color}`].disable();
		buttons[`color ${color}`].show();
		if (color !== thePlayer.color) ctx.drawImage(IMAGES[FAIL_X].img, x, y, w, h);
	}
}

function drawPopUp() {
	var screenPos = thePlayer && thePlayer.isDemon ? 0.35 : 0.15;
	var screenL = 0.3;
	overlayed = true;
	var x = screenPos * cvW + wOff;
	var y = 0.4 * cvH + hOff;
	var w = screenL * cvW;
	var h = 0.18 * cvH;
	drawRect("#333333", x, y, w, h, true);
	drawRect("#810000", x + 10, y + 10, w - 20, h - 20, true);
	var msg = new Label(popupMessage, 20).setPosition(screenPos + screenL / 2, 0.46);
	scaleLabelsToWidth([msg], w - 30, 10);
	msg.draw();
	buttons["clear popup"].setPosition(screenPos + screenL / 2, 0.53);
	buttons["clear popup"].enable();
	buttons["clear popup"].draw();
}

function drawDemonAccept() {
	var screenPos = 0.1;
	var screenL = 0.4;
	overlayed = true;
	var x = screenPos * cvW + wOff;
	var y = 0.4 * cvH + hOff;
	var w = screenL * cvW;
	var h = 0.18 * cvH;
	drawRect("#333333", x, y, w, h, true);
	drawRect("#810000", x + 10, y + 10, w - 20, h - 20, true);
	drawGroups["accept demon"].enable();
	drawGroups["accept demon"].draw();
}

////// Main game \\\\\\\\

function drawDemonControlPanel() {
	// Player area
	drawRect("#575757", 0.02, 0.02, 0.96, 0.16);

	var padRad = Math.min(0.04, 0.96 / (theTable.players.length - 1) / 2.2) * cvW;
	var margin = Math.min(20, (0.96 * cvW - padRad * (theTable.players.length - 1) * 2) / theTable.players.length);

	var x = 0.02 * cvW + wOff;
	if (theTable.currentMove && theTable.currentMove.type === constants.items.SALT) drawDemonSalt(x, 0.03 * cvH + hOff, 0.17 * cvH + hOff, padRad, margin);

	x += padRad + margin;
	var y = 0.1 * cvH + hOff;
	for (var player of theTable.players) {
		if (player.isDemon) continue;
		drawPlayerPad(player, x, y, padRad);
		x += padRad * 2 + margin;
	}

	// Demon message
	drawText(theTable.demonMessage ? theTable.demonMessage : theTable.message, 0.16, 0.23, 20, "left", false, 0.4 * cvW);
	if (gameState == constants.states.INTERFERE && interfereUses[theTable.currentMove.type] > 0) drawGroups[`${theTable.currentMove.type === constants.items.SALT ? "salt " : ""}interfere`].draw();

	// Items
	if (gameState === constants.states.DAY) {
		drawGroups["items"].enable();
	} else {
		drawGroups["items"].show();
	}
	buttons[constants.moves.PASS].disable();
	drawText("Tools", 0.08, 0.23, 15);
	var panelH = 0.6;
	drawRect("#333333", 0.02, 0.25, 0.12, panelH);
	var margin = 0.01;
	var h = (panelH - margin * (theTable.itemsInUse.length + 1)) / theTable.itemsInUse.length
	for (var i = 0; i < theTable.itemsInUse.length; i++) {
		var dx = 0.08 * cvW + wOff;
		var dy =(0.25 + h * 0.5 + margin * (i + 1) + h * i) * cvH + hOff;
		drawItemButton(theTable.itemsInUse[i], dx, dy, h);
	}

	// Drawing the demon chat panels.
	var numToPossess = Math.ceil((theTable.players.length - 1) / 2);
	var numSlots = numToPossess > 3 ? 6 : 3;
	var x = 0.15;
	var y = 0.25;
	var h = (0.85 - y) / (numToPossess > 3 ? 2 : 1);
	var w = 0.21;
	var margin = 0.005;
	var nameHeight = 0.04;
	if (ALT) {
		drawRect("white", x, y, 0.63, 0.85 - y);
	}
	for (i = 0; i < numSlots; i++) {
		var dx = x + (i % 3) * w + margin;
		var dy = y + h * Math.floor(i / 3) + margin;
		var dw = w - margin * 2;
		var dh = h - margin * 2;
		if (i < possessedPlayers.length) {
			if (!ALT && selectedPlayer === possessedPlayers[i]) drawRect("white", dx - margin, dy - margin, w, h);
			drawRect(getPlayerByName(possessedPlayers[i]).color, dx, dy, dw, nameHeight);
			drawText(possessedPlayers[i], dx + w / 2, dy + nameHeight * 0.75, 15, undefined, undefined, undefined, undefined, "black");
		} else {
			drawRect("#333333", dx, dy, dw, dh);
			new ImageLabel(IMAGES[PENTAGRAM_GRAY]).setPosition(dx + dw * 0.5, dy + dh * 0.5).setDims(dw / 2).setCenter(true).draw();
		}
	}
	// Item fast chat buttons
	var dx = 0.3;
	for (var item of theTable.itemsInUse) {
		buttons[`fast chat ${item}`].setPosition(dx, 0.875).setMargin(5 * r).enable().draw();
		dx -= 0.05;
	}
	// Position player quick chat buttons
	var dx = 0.72;
	var dy = 0.875;
	for (var player of theTable.players) {
		if (player.isDemon) continue;
		buttons[`fast chat ${player.name}`].setPosition(dx, dy).setBackground(player.color).enable().draw();
		if (dy === 0.925) {
			dx += 0.05;
			dy = 0.875;
		} else {
			dy = 0.925;
		}
	}

	if (theTable.settings.turnOrder && theTable.round) labels["round timer title"].enable().draw();

	drawGroups["fast chat"].enable().draw();
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) return;
	
	// Draw table
	labels["table_img"].draw();

	if (theTable.settings.turnOrder && theTable.round) labels["round timer title"].enable().draw();

	if (theTable.currentMove && theTable.currentMove.type === constants.items.SALT) drawSalt();

	// Draw message.
	var msg = theTable.message;
	if (gameState === constants.states.LOBBY) {
		if (theTable.players.length >= theTable.settings.minPlayers) {
			msg = isTableOwner() ? "Press 'Start Game' to begin" : "Waiting for owner to start game";
		} else {
			msg = "Waiting for more players to join...";
		}
	} else if (gameState === constants.states.INTERPRET && thePlayer.name === theTable.currentMove.playerName) {
		msg = `The divining rod reveals that ${theTable.currentMove.targetName} ${rodResult ? "IS" : "IS NOT"} possessed.`;
	}
	drawText(msg, 0.3, 0.5, 20, "center", false, labels["table_img"].dims().width * 0.9);

	// Draw buttons
	if (gameState === constants.states.DAY) {
		if (thePlayer.move) drawGroups["items"].disable().show();
		drawGroups["items"].draw();
		drawTableItems();
	}

	// Draw players
	drawPlayers();
}

function drawTableItems() {
	var tableWidth = labels["table_img"].dims().width;

	var itemHeight = tableWidth * 0.25;
	var tableX = labels["table_img"].x() + tableWidth * 0.125;
	var tableY = labels["table_img"].y() + tableWidth * 0.25; 

	var half = Math.ceil(theTable.itemsInUse.length / 2);
	var itemHeight = (tableWidth * 0.75) / (half + 1);
	for (var i = 0; i < theTable.itemsInUse.length; i++) {
		var row = Math.floor(i / half);
		var col = i % half;
		var inRow = row === 0 ? half : theTable.itemsInUse.length - half;
		var margin = (tableWidth * 0.75 - itemHeight * inRow) / (inRow + 1);
		var dx = tableX + margin * (col + 1) + itemHeight * (col + 0.5);
		var dy = tableY + tableWidth * 0.5 * row;
		drawItemButton(theTable.itemsInUse[i], dx, dy, itemHeight / cvH);
	}
}

function drawItemButton(item, x, y, size) {
	var num = Math.max(0, theTable.resources[item] || 0);
	if (!num) buttons[item].disable().show();
	buttons[item].setPosition(x, y).setDims(false, size).setBackground(BUTTON_BACKGROUND).setMargin(10 * r).draw();
	new Label(`${num} x `, 12).setPosition(x - size * 0.075 * cvW, y - size * 0.275 * cvH).setAbsolute(true).setColor(buttons[item].textColor()).setAlign("right").draw();
	if (thePlayer.isDemon) drawCircle(interfereUses[item] > 0 ? "green" : "red", x - size * 0.2 * cvW, y + size * 0.3 * cvH, 5 * r);
}

function drawPlayers() {
	var padRad = 0.045 * cvW;
	var tableRad = labels["table_img"].dims().width / 2;
	var playerRad = tableRad + padRad * 1.05;
	var tableX = labels["table_img"].x() + tableRad;
	var tableY = labels["table_img"].y() + tableRad;
	var angle = 180; 
	var delta = 360 / (theTable.players.length - ([constants.states.LOBBY, constants.states.END, constants.states.DEMON_SELECTION].includes(gameState) ? 0 : 1));

	for (var player of theTable.players) {
		if (player.isDemon && gameState !== constants.states.END) continue;
		var rad = Math.PI * angle / 180;
		var x = tableX - Math.sin(rad) * playerRad;
		var y = tableY + Math.cos(rad) * playerRad;
		drawPlayerPad(player, x, y, padRad);
		angle = (angle + delta) % 360;
	}
}

function drawDemonSalt(xStart, yTop, yBot, padRad, margin) {
	if (theTable.saltLine.start === undefined) return;
	
	// Track salt line groupings, so we can display what the result will be to demon.
	var groupRed = [false, false];
	var saltBreaks = [0];
	var startGroup = theTable.saltLine.start < theTable.saltLine.end ? 1 : 0;
	var currGroup = startGroup;

	var saltIndex = 0;
	for (var i = 0; i < theTable.players.length - 1; i++) {
		if (theTable.players[i].isDemon) continue;

		groupRed[currGroup] |= possessedPlayers.includes(theTable.players[i].name);
		if (saltIndex === theTable.saltLine.start || saltIndex === theTable.saltLine.end) {
			currGroup = 1 - currGroup;
			saltBreaks.push(saltIndex + 1);
			ctx.strokeStyle = WHITE;
			ctx.lineWidth = 2.5 * r;
			ctx.beginPath();
			var x = xStart + padRad * 2 * (saltIndex + 1) + margin * (saltIndex + 1.5);
			ctx.moveTo(x, yTop);
			ctx.lineTo(x, yBot);
			ctx.stroke();
		}
		saltIndex++;
	}
	saltBreaks.push(theTable.players.length - 1);
	// Draw block
	console.log(`!!!! START GROUP: ${startGroup}, flips: ${saltFlip[0]} ${saltFlip[1]}`)
	if (theTable.saltLine.start !== undefined && theTable.saltLine.end != undefined) {
		var yTop = (yTop + yBot) / 2 - padRad - margin * 0.1;
		for (var i = 0; i < saltBreaks.length - 1; i++) {
			var blockX = xStart + padRad * 2 * saltBreaks[i] + margin * (saltBreaks[i] + 1 - 0.1);
			var blockLen = padRad * 2 * (saltBreaks[i + 1] - saltBreaks[i]) + margin * (saltBreaks[i + 1] - saltBreaks[i] - 1 + 0.2);
			var isRed = saltFlip[(startGroup + i) % 2] ? !groupRed[(startGroup + i) % 2] : groupRed[(startGroup + i) % 2];
			drawRect(isRed ? BUTTON_BACKGROUND : BUTTON_TEXT, blockX, yTop, blockLen, padRad * 2 + margin * 0.2, true);
		}
	}
}

function drawSaltLine(tempEnd) {
	// TODO: implement tempEnd to show ghost salt line while selecting.
	if (theTable.saltLine.start === undefined) return;
	var end = theTable.saltLine.end || tempEnd;
	if (end === undefined) return;

	var tableRad = labels["table_img"].dims().width / 2;
	var tableX = labels["table_img"].x() + tableRad;
	var tableY = labels["table_img"].y() + tableRad;
	var delta = 360 / (theTable.players.length - 1);

	var startAngle = 180 + delta * (theTable.saltLine.start + 0.5);
	var endAngle = 180 + delta * (theTable.saltLine.end + 0.5);

	// TODO: bezier curve

	ctx.strokeStyle = WHITE;
	ctx.lineWidth = 10 * r;
	ctx.beginPath();
	ctx.moveTo(tableX - Math.sin(Math.PI * startAngle / 180) * tableRad, tableY + Math.cos(Math.PI * startAngle / 180) * tableRad);
	ctx.lineTo(tableX, tableY);
	ctx.lineTo(tableX - Math.sin(Math.PI * endAngle / 180) * tableRad, tableY + Math.cos(Math.PI * endAngle / 180) * tableRad);
	ctx.stroke();

	if (gameState === constants.states.DISPLAY) {
		ctx.fillStyle = theTable.saltLine.result[0] ? BUTTON_BACKGROUND : BUTTON_TEXT;
		var centerAngle = (startAngle + endAngle) / 2 + (startAngle > endAngle ? 180 : 0);
		ctx.beginPath();
		ctx.moveTo(tableX - Math.sin(Math.PI * centerAngle / 180) * tableRad * 0.1, tableY + Math.cos(Math.PI * centerAngle / 180) * tableRad * 0.1);
		ctx.lineTo(tableX - Math.sin(Math.PI * (startAngle + 5) / 180) * tableRad * 0.9, tableY + Math.cos(Math.PI * (startAngle + 5) / 180) * tableRad * 0.9);
		// Note: for arc, 0 is at the 3 o'clock position, but for correct sin/cos calculations, 0 is at 6 o'clock, so add 90 to get correct position.
		ctx.arc(tableX, tableY, tableRad * 0.9, Math.PI * (startAngle + 5 + 90) / 180, Math.PI * (endAngle - 5 + 90) / 180);
		ctx.fill();

		ctx.fillStyle = theTable.saltLine.result[1] ? BUTTON_BACKGROUND : BUTTON_TEXT;
		ctx.beginPath();
		ctx.moveTo(tableX - Math.sin(Math.PI * (centerAngle + 180) / 180) * tableRad * 0.1, tableY + Math.cos(Math.PI * (centerAngle + 180) / 180) * tableRad * 0.1);
		ctx.lineTo(tableX - Math.sin(Math.PI * (endAngle + 5) / 180) * tableRad * 0.9, tableY + Math.cos(Math.PI * (endAngle + 5) / 180) * tableRad * 0.9);
		// Note: for arc, 0 is at the 3 o'clock position, but for correct sin/cos calculations, 0 is at 6 o'clock, so add 90 to get correct position.
		ctx.arc(tableX, tableY, tableRad * 0.9, Math.PI * (endAngle + 5 + 90) / 180, Math.PI * (startAngle - 5 + 90) / 180);
		ctx.fill();
	}
}

function drawSalt() {
	drawSaltLine();

	if (theTable.currentMove.playerName !== thePlayer.name) return;

	var tableRad = labels["table_img"].dims().width / 2;
	var tableX = labels["table_img"].x() + tableRad;
	var tableY = labels["table_img"].y() + tableRad;
	var delta = 360 / (theTable.players.length - 1);
	var angle = 180 + delta / 2;

	for (var i = 0; i < theTable.players.length - 1; i++) {
		var rad = Math.PI * angle / 180;
		var x = tableX - Math.sin(rad) * tableRad;
		var y = tableY + Math.cos(rad) * tableRad;
		buttons[`salt ${i}`].setPosition(x, y).draw();
		angle = (angle + delta) % 360;
	}
	drawGroups["salt"].draw();
}

function drawPlayerPad(player, x, y, rad) {
	// Draw pentagram under the player pad if player is possessed for player and demon.
	var pent = IMAGES[PENTAGRAM_GRAY];
	if (player.isDamned || (thePlayer.isDemon && possessedPlayers.includes(player.name)) || (thePlayer.name === player.name && thePlayerIsPossessed)) {
		pent = IMAGES[PENTAGRAM];
	}
	if (player.isDemon) pent = IMAGES[PENTAGRAM_RED];
	drawImage(pent, x, y, rad * 2 / cvW, false, true, true);
	drawCircle(player.color, x, y, rad * 0.78);

	// Move player avatar/button to position.
	buttons[player.name].setPosition(x - rad * 0.25,  y - rad * 0.1);
	buttons[player.name].width = rad * 1.5 / cvW;
	buttons[player.name].on_img = PLAYER_IMAGES[player.avatarId];
	// Enable button for the demon, and for player selecting another player for a move.
	buttons[player.name].enabled = (thePlayer.isDemon && !(possessedPlayers.includes(player.name) || player.name === smudgedPlayer || player.isPurified || player.wasPurified)) || (gameState === constants.states.SELECT && theTable.currentMove.playerName === thePlayer.name && player.name !== thePlayer.name);
	buttons[player.name].visible = true;
	buttons[player.name].draw();
	
	if (player.isExorcised) drawImage(IMAGES[constants.items.EXORCISM], x - rad * 0.25, y - rad * 0.2, false, rad * 0.8 / cvH, true, true);
	if (player.isSmudged) drawImage(IMAGES[BURNING_SMUDGE], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (player.wasSmudged && !player.isSmudged) drawImage(IMAGES[BURNED_SMUDGE], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (thePlayer.isDemon && player.isSmudged && player.name !== smudgedPlayer) drawImage(IMAGES[FAIL_X], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (player.isPurified || player.wasPurified) drawImage(IMAGES[constants.items.WATER], x + rad * 0.1, y + rad * 0.15, false, rad * 0.5 / cvH, true, true);

	// Draw name
	drawImage(IMAGES[NAMEPLATE], x, y + rad * 0.6, rad * 1.6 / cvW, false, true, true);
	drawText(player.active ? player.name : `< ${player.name} >`, x, y + rad * 0.7, 15, undefined, true, rad * 1.4, 5, player.active ? "black" : "gray");
	// Draw start player and current player indicators
	if (theTable.currentPlayer !== undefined && player.name === getCurrentPlayer().name) drawCircle("green", x - rad * 0.8, y + rad * 0.5, r * 3);
	if (theTable.startPlayer !== undefined && player.name === theTable.players[theTable.startPlayer].name) drawCircle("blue", x - rad * 0.8, y + rad * 0.9, r * 3);

	// Draw player's move
	if (player.move) { 
		drawImage(IMAGES[player.move.type], x + rad * 0.4, y - rad * 0.3, false, rad * 0.6 / cvH, true, true);
		if (player.move.success === false) drawImage(IMAGES[FAIL_X], x + rad * 0.4, y - rad * 0.3, false, rad * 0.6 / cvH, true, true);
	}
	// Draw player vote indicator
	if (player.voted) {
		var image = player.vote === undefined ? IMAGES[VOTED] : (player.vote ? IMAGES[YES_VOTE] : IMAGES[NO_VOTE]);
		drawImage(image, x + rad * 0.4, y + rad * 0.176, undefined, rad * 0.6 / cvH, true, true);
	}
}

///// Drawing utilities \\\\\\\

function drawText(text, x, y, size, align, absolute, scaleWidth, margin, color) {
	var l = new Label(text, size).setPosition(x, y).setAbsolute(absolute).setColor(color).setAlign(align);
	scaleLabelsToWidth([l], scaleWidth, margin);
	l.draw();
}

function drawImage(image, x, y, w, h, center, absolute) {
	new ImageLabel(image).setPosition(x, y).setDims(w, h).setCenter(center).setAbsolute(absolute).draw();
}

function drawRect(color, x, y, w, h, absolute=false) {
	if (!absolute) {
		x = x * cvW + wOff;
		y = y * cvH + hOff;
		w *= cvW;
		h *= cvH;
	}
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
}

function drawCircle(color, x, y, r) {
	// NOTE: this function only works with absolute coords right now.
	ctx.fillStyle = color;
	ctx.lineWidth = 0.1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.stroke();
}

function scaleLabelsToWidth(labels, width, margin=0) {
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
	input.id = "game-log";
	input.type = "ul";
	input.style.display = "none";
	container.appendChild(input);

	input = document.createElement("ul");
	input.id = "demon-chat";
	input.type = "ul";
	input.className = "demon-chat";
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

var hand, canvas, ctx, cvW, cvH;
var clickCursor = false,
	aspect = 16 / 10,
	BACKGROUND_COLOR = "#222222",
	LABEL_FONT = "Tahoma",
	WHITE = "#ffffff",
	BUTTON_BACKGROUND = "#810000",
	BUTTON_BORDER = "#5c0000",
	BUTTON_TEXT = "#ffffff",
	BUTTON_DISABLED = "gray";

var VERSION = "v0.1.2";
var ELEM_CONFIGS = {
	"player-name": {
		x: 0.288,
		y: 0.63,
		w: 0.3,
		h: 0.09,
		size: 40,
	},
	"game-code": {
		x: 0.594,
		y: 0.63,
		w: 0.12,
		h: 0.09,
		size: 40,
	},
	"player-chat": {
		x: 0.60,
		y: 0.07,
		w: 0.35,
		h: 0.83,
		size: 10,
	},
	"game-log": {
		x: 0.60,
		y: 0.07,
		w: 0.35,
		h: 0.83,
		size: 10,
	},
	"chat-input": {
		x: 0.6,
		y: 0.9,
		w: 0.32,
		h: 0.05,
		size: 10,
	},
	"demon-chat": {
		x: 0.6,
		y: 0.7,
		w: 0.35,
		h: 0.25,
		size: 10,
	},
};

init();
animate();

window.addEventListener("resize", handleResize, false);
window.addEventListener("mousemove", handleMouseMove, false);
window.addEventListener("mousedown", handleMouseDown, false);
window.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);