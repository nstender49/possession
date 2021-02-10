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
		drawText(utils.title(setting), 0.6, dy + 0.01, 15, "right");
		buttons[`decrease ${setting}`].setPosition(0.65, dy);
		drawText(utils.formatSec(theTable.settings.times[setting]), 0.7, dy + 0.01, 15);
		buttons[`increase ${setting}`].setPosition(0.75, dy);
	}

	drawGroups["settings"].draw();
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