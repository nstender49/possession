// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.

//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	loadImages();
	initInputs();
	initLabels();

	changeState(INIT);
	
	handleResize();
}

function loadImages() {
	allLoaded = false;
	while (!allLoaded) {
		allLoaded = true;
		for (var img of IMAGES) {
			allLoaded &= img.loaded;
		}
		// TODO: player images not being marked as loaded, even though they are?
		/*
		for (var img of PLAYER_IMAGES) {
			console.log(`CHECKING ${img} LOADED`);
			allLoaded &= img.loaded;
			if (!img.loaded) console.log(`!!! NOT LOADED! ${img.img.src}`);
		}
		*/
	}
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
		if (button.under(cursorX, cursorY)) {
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
var CTRL = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
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
		case 17:    // shift
			CTRL = true;
			break;
		case 27: 	// esc
			if (gameState === TABLE_LOBBY) {
				buttons["leave table"].click();
			} else {
				buttons[PASS].click();
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
		case 17:
			CTRL = false;
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

	// Resize input boxes
	for (var config of ELEM_CONFIGS) {
		var elem = document.getElementById(config.name);
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
		document.getElementById("player-name").value = "P" + Math.floor(Math.random() * 100);
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
	ctx.drawImage(IMAGES[BACK].img, 0, 0, window.innerWidth, window.innerHeight);
	// drawRect(BACKGROUND_COLOR, 0, 0, 1, 1);
	if (gameState === INIT) return;

	// Check for holding buttons.
	for (var button of getButtons()) button.checkHold(cursorX, cursorY);

	if (gameState !== MAIN_MENU) drawGroups["chat"].draw();

	if (gameState === MAIN_MENU) {
		drawGroups["main menu"].draw();
	} else if (gameState === TABLE_LOBBY) {
		drawTable();
		if (theTable.players.length >= theTable.settings.minPlayers && isTableOwner()) {
			buttons["begin game"].enable();
			buttons["begin game"].draw();
		}
		buttons["leave table"].draw();
		buttons["change avatar"].draw();
	} else if (thePlayer.isDemon) {
		drawDemonView();
	} else {
		drawPlayerView();
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

function drawPlayerView() {
	drawTable();

	switch (gameState) {
		case TABLE_NIGHT:
			break;
		case TABLE_DISCUSS:
			buttons["ready"].draw();
			break;
		case TABLE_DAY:
			drawTableItems();
			break;
		case TABLE_SECONDING:
		case TABLE_VOTING:
			labels[theTable.currentMove.type].draw();
			if (thePlayer.isExorcised) {
				drawGroups["voting"].disable();
			} else {
				drawGroups["voting"].draw();
			}
			break;
		case TABLE_SELECT:
			labels[theTable.currentMove.type].draw();
			break;
		case TABLE_DISPLAY:
			if (theTable.currentMove && theTable.currentMove.type !== PASS) labels[theTable.currentMove.type].draw();
			break;
		case TABLE_INTERFERE:
			labels[theTable.currentMove.type].draw();
			break;
		case TABLE_END:
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
		case TABLE_NIGHT:
			break;
		case TABLE_DISCUSS:
			break;
		case TABLE_DAY:
			break;
		case TABLE_SECONDING:
		case TABLE_VOTING:
			break;
		case TABLE_SELECT:
			break;
		case TABLE_DISPLAY:
			break;
		case TABLE_INTERFERE:
			break;
		case TABLE_END:
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
					"    Players may perform one exorcism per round. The target player is knocked unconscious until the next round,",
					"    unable to speak or vote (they are not counted in vote ratio).  Performing an exorcism gives the demon a ",
					"    window into the world, granting them one additional chance to interfere with the Spirit Board.",
				],
			};
			var items = [BOARD, ROD, WATER, EXORCISM];

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
	for (var i = 0; i < AVATAR_COUNT; i++) {
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
	for (var i = 0; i < 14; i ++) {
		var color = PLAYER_COLORS[i];
		var boxX = x + gapWidth * (i + 1) + boxWidth * i;
		var boxY = y + 0.8 * cvH;
		drawColorSelector(color, boxX, boxY, boxWidth, boxWidth);
	}

	buttons["clear avatar"].enable();
	buttons["clear avatar"].draw();
}

function drawColorSelector(color, x, y, w, h) {
	if (color === thePlayer.color) {
		drawRect("gray", x - 2, y - 2, w + 4, h + 4, true);
	}
	buttons[`color ${color}`].setPosition(x, y);
	buttons[`color ${color}`].width = w / cvW;
	buttons[`color ${color}`].height = h / cvH;
	buttons[`color ${color}`].draw();
	if (theTable.playerColors.includes(color)) {
		buttons[`color ${color}`].disable();
		buttons[`color ${color}`].show();
		if (color !== thePlayer.color) ctx.drawImage(IMAGES[FAIL_X].img, x, y, w, h);
	}
}

function drawPopUp() {
	overlayed = true;
	var x = 0.15 * cvW + wOff;
	var y = 0.4 * cvH + hOff;
	var w = 0.3 * cvW;
	var h = 0.18 * cvH;
	drawRect("#333333", x, y, w, h, true);
	drawRect("#810000", x + 10, y + 10, w - 20, h - 20, true);
	var msg = new Label(popupMessage, 20).setPosition(0.3, 0.46);
	scaleLabelsToWidth([msg], w - 30, 10);
	msg.draw();
	buttons["clear popup"].enable();
	buttons["clear popup"].draw();
}

////// Main game \\\\\\\\

function drawDemonControlPanel() {
	// Draw players
	var padRad = Math.min(0.035, 0.96 / (theTable.players.length - 1) / 2.6) * cvW;
	drawRect("#575757", 0.02, 0.02, 0.96, 0.17);
	var x = 0.02 * cvW + wOff + padRad * 1.3;
	var y = 0.1 * cvH + hOff;
	for (var player of theTable.players) {
		if (player.isDemon) continue;
		drawPlayerPad(player, x, y, padRad);
		x += padRad * 2.6;
	}

	// Demon message
	drawText(theTable.demonMessage ? theTable.demonMessage : theTable.message, 0.5, 0.23, 20);

	// Items
	drawText("Tools", 0.07, 0.23, 15);
	var panelH = 0.6;
	drawRect("#333333", 0.02, 0.25, 0.12, panelH);
	var margin = 0.04;
	var h = Math.min(0.12, (panelH - margin * (ITEMS.length + 1)) / ITEMS.length);
	for (var i = 0; i < ITEMS.length; i++) {
		var dx = 0.09 * cvW + wOff;
		var dy =(0.25 + h * 0.5 + margin * (i + 1) + h * i) * cvH + hOff;
		drawItemButton(ITEMS[i], dx, dy, h);
	}
	if (gameState === TABLE_DAY) {
		drawGroups["items"].enable();
	} else {
		drawGroups["items"].show();
	}
	buttons[PASS].disable();
	drawGroups["items"].draw();

	// Drawing the demon chat panels.
	var numToPossess = Math.ceil((theTable.players.length - 1) / 2);
	var numSlots = numToPossess > 3 ? 6 : 3;
	var x = 0.15;
	var y = 0.25;
	var h = (0.85 - y) / (numToPossess > 3 ? 2 : 1);
	var w = 0.21;
	var margin = 0.005;
	var nameHeight = 0.04;
	if (CTRL) {
		drawRect("white", x, y, 0.63, 0.85 - y);
	}
	for (i = 0; i < numSlots; i++) {
		var dx = x + (i % 3) * w + margin;
		var dy = y + h * Math.floor(i / 3) + margin;
		var dw = w - margin * 2;
		var dh = h - margin * 2;
		if (i < possessedPlayers.length) {
			if (!CTRL && selectedPlayer === possessedPlayers[i]) drawRect("white", dx - margin, dy - margin, w, h);
			drawRect(getPlayerByName(possessedPlayers[i]).color, dx, dy, dw, nameHeight);
			drawText(possessedPlayers[i], dx + w / 2, dy + nameHeight * 0.75, 15, undefined, undefined, undefined, undefined, "black");
		} else {
			drawRect("#333333", dx, dy, dw, dh);
			drawImage(IMAGES[PENTAGRAM_GRAY], dx + dw * 0.5, dy + dh * 0.5, dw / 2, false, true);
		}
	}
	// Position player quick chat buttons
	var dx = 0.72;
	var dy = 0.885;
	for (var player of theTable.players) {
		buttons[`fast chat ${player.name}`].setPosition(dx, dy).setColor(player.color).enable().draw();
		if (dy === 0.935) {
			dx += 0.07;
			dy = 0.885;
		} else {
			dy = 0.935;
		}
	}

	drawGroups["fast chat"].enable();
	drawGroups["fast chat"].draw();
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) {
		return;
	}

	// Draw table
	labels["table_img"].draw();
	labels["table pentagram"].draw();

	// Draw message.
	var msg = theTable.message;
	if (gameState === MAIN_MENU && theTable.players.length >= theTable.settings.minPlayers && isTableOwner()) {
		msg = "Press Begin to start game!";
	}
	drawText(msg, 0.3, 0.48, 20, "center", false, labels["table_img"].dims().width * 0.9);

	// Draw buttons
	if (gameState === TABLE_DAY) {
		if (thePlayer.move) {
			drawGroups["items"].disable();
			drawGroups["items"].show();
		}
		drawGroups["items"].draw();
		drawTableItems();
	}

	drawGroups["timers"].draw();

	// Draw players
	drawPlayers();
}

function drawTableItems() {
	var tableWidth = labels["table_img"].dims().width;
	var itemHeight = tableWidth * 0.25;
	var tableX = labels["table_img"].x() + tableWidth * 0.125;
	var tableY = labels["table_img"].y() + tableWidth * 0.25; 

	var half = Math.ceil(ITEMS.length / 2);
	for (var i = 0; i < ITEMS.length; i++) {
		var row = Math.floor(i / half);
		var col = i % half;
		var inRow = row === 0 ? half : ITEMS.length - half;
		var margin = (tableWidth * 0.75 - itemHeight * inRow) / (inRow + 1);
		var dx = tableX + margin * (col + 1) + itemHeight * (col + 0.5);
		var dy = tableY + tableWidth * 0.5 * row;
		drawItemButton(ITEMS[i], dx, dy, itemHeight / cvH);
	}
}

function drawItemButton(item, x, y, itemHeight) {
	buttons[item].setPosition(x, y).setDims(false, itemHeight);
	drawText(`${Math.max(0, theTable.resources[item] || 0)} x `, x - itemHeight * 0.25 * cvW, y - itemHeight * 0.2 * cvH, 15, "right", true); 
	if (thePlayer.isDemon) drawCircle(interfereUses[item] > 0 ? "green" : "red", x - itemHeight * 0.35 * cvW, y + itemHeight * 0.2 * cvH, 10);
}

function drawPlayers() {
	var padRad = 0.04 * cvW;
	var tableRad = labels["table_img"].dims().width / 2;
	var playerRad = tableRad + padRad * 1.25;
	var tableX = labels["table_img"].x() + tableRad;
	var tableY = labels["table_img"].y() + tableRad;
	var angle = 180; 
	var delta = 360 / (theTable.players.length - ([TABLE_LOBBY, TABLE_END].includes(gameState) ? 0 : 1));

	for (var player of theTable.players) {
		if (player.isDemon) continue;
		var rad = Math.PI * angle / 180;
		var x = tableX - Math.sin(rad) * playerRad;
		var y = tableY + Math.cos(rad) * playerRad;
		drawPlayerPad(player, x, y, padRad);
		angle = (angle + delta) % 360;
	}
}

function drawPlayerPad(player, x, y, r) {
	// Draw pentagram under the player pad if player is possessed for player and demon.
	if (player.isDamned || (thePlayer.isDemon && possessedPlayers.includes(player.name)) || (thePlayer.name === player.name && thePlayerIsPossessed)) {
		drawImage(IMAGES[PENTAGRAM], x, y, r * 2.75 / cvW, false, true, true);
	}
	drawCircle(player.color, x, y, r);

	// Move player avatar/button to position.
	buttons[player.name].setPosition(x - r * 0.25,  y - r * 0.18);
	buttons[player.name].width = r * 1.6 / cvW;
	buttons[player.name].on_img = PLAYER_IMAGES[player.avatarId];
	// Enable button for the demon, and for player selecting another player for a move.
	buttons[player.name].enabled = thePlayer.isDemon || gameState === TABLE_SELECT && theTable.currentMove.playerName === thePlayer.name && player.name !== thePlayer.name;
	buttons[player.name].visible = true;
	buttons[player.name].draw();
	if (player.isExorcised) drawImage(IMAGES[EXORCISM], x - r * 0.25, y - r * 0.25, false, r * 1.2 / cvH, true, true);

	// Draw name
	drawImage(IMAGES[NAMEPLATE], x, y + r * 0.7, r * 2 / cvW, false, true, true);
	drawText(player.active ? player.name : `< ${player.name} >`, x, y + r * 0.85, 15, undefined, true, r * 2, 5, player.active ? "black" : "gray");
	// Draw start player and current player indicators
	if (theTable.currentPlayer !== undefined && player.name === getCurrentPlayer().name) drawCircle("green", x - r * 0.75, y + r * 0.5, 5);
	if (theTable.startPlayer !== undefined && player.name === theTable.players[theTable.startPlayer].name) drawCircle("blue", x - r * 0.75, y + r * 0.9, 5);

	// Draw player's move
	if (player.move) { 
		drawImage(IMAGES[player.move.type], x + r * 0.5, y - r * 0.4, false, r * 0.7 / cvH, true, true);
		if (player.move.success === false) drawImage(IMAGES[FAIL_X], x + r * 0.5, y - r * 0.4, false, r * 0.6 / cvH, true, true);
	}
	// Draw player vote indicator
	if (player.voted) {
		var image = player.vote === undefined ? IMAGES[VOTED] : (player.vote ? IMAGES[YES_VOTE] : IMAGES[NO_VOTE]);
		drawImage(image, x + r * 0.5, y + r * 0.2, undefined, r * 0.7 / cvH, true, true);
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
		x: 0.60,
		y: 0.07,
		w: 0.35,
		h: 0.83,
		size: 10,
	},
	{
		name: "game-log",
		x: 0.60,
		y: 0.07,
		w: 0.35,
		h: 0.83,
		size: 10,
	},
	{
		name: "chat-input",
		x: 0.6,
		y: 0.9,
		w: 0.32,
		h: 0.05,
		size: 10,
	},
	{
		name: "demon-chat",
		x: 0.6,
		y: 0.7,
		w: 0.35,
		h: 0.25,
		size: 10,
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