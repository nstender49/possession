function drawDemonControlPanel() {
	// Player area
	drawRect("#575757", 0.02, 0.02, 0.96, 0.16);

    // Draw players
	var padRad = Math.min(0.04, 0.96 / numPlayersAtTable() / 2.2) * cvW;
	var margin = Math.min(20, (0.96 * cvW - padRad * numPlayersAtTable() * 2) / (numPlayersAtTable() + 1));
	var x = 0.02 * cvW + wOff;
	if (theTable.currentMove && theTable.currentMove.type === constants.items.SALT) drawDemonSalt(x, 0.03 * cvH + hOff, 0.17 * cvH + hOff, padRad, margin);
	x += padRad + margin;
	var y = 0.1 * cvH + hOff;
	for (var player of theTable.players) {
		if (player.isDemon) continue;
		drawPlayerPad(player, x, y, padRad);
		x += padRad * 2 + margin;
	}

	// Draw message
	drawText(theTable.demonMessage ? theTable.demonMessage : theTable.message, 0.16, 0.23, 20, "left", false, 0.4 * cvW);
	if (gameState == constants.states.INTERFERE && interfereUses[theTable.currentMove.type] > 0) drawGroups[`${theTable.currentMove.type === constants.items.SALT ? "salt " : ""}interfere`].draw();

	// Draw items
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

	// Draw demon chat panels
	var numToPossess = Math.ceil(numPlayersAtTable() / 2);
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
			const tablePlayer = getPlayer(possessedPlayers[i]);
			drawRect(tablePlayer.color, dx, dy, dw, nameHeight);
			drawText(tablePlayer.name, dx + w / 2, dy + nameHeight * 0.75, 15, undefined, undefined, undefined, undefined, "black");
		} else {
			drawRect("#333333", dx, dy, dw, dh);
			new ImageLabel(IMAGES[PENTAGRAM_GRAY]).setPosition(dx + dw * 0.5, dy + dh * 0.5).setDims(dw / 2).setCenter(true).draw();
		}
	}

	// Fast chat
    drawGroups["fast chat"].enable().draw();
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
		buttons[`fast chat ${player.id}`].setPosition(dx, dy).setBackground(player.color).enable().draw();
		if (dy === 0.925) {
			dx += 0.05;
			dy = 0.875;
		} else {
			dy = 0.925;
		}
	}
}

function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) return;
	
	// Draw table
	labels["table_img"].draw();
    const tableDims = labels["table_img"].buttonDims();

	if (theTable.currentMove && theTable.currentMove.type === constants.items.SALT) drawSalt();

	// Draw message.
	var msg = theTable.message;
	if (gameState === constants.states.LOBBY) {
		if (theTable.players.length >= theTable.settings.minPlayers) {
			msg = isTableOwner() ? "Press 'Start Game' to begin" : "Waiting for owner to start game";
		} else {
			msg = "Waiting for more players to join...";
		}
	} else if (gameState === constants.states.INTERPRET && thePlayer.id === theTable.currentMove.playerId) {
		msg = `The divining rod reveals that ${theTable.currentMove.targetName} ${rodResult ? "IS" : "IS NOT"} possessed.`;
	}
	drawText(msg, 0.3, 0.5, 20, "center", false, tableDims.width * 0.9);

	// Draw items.
	if (gameState === constants.states.DAY) {
		if (thePlayer.move) drawGroups["items"].disable().show();

        var itemHeight = tableDims.width * 0.25;
        var tableX = labels["table_img"].x() + tableDims.width * 0.125;
        var tableY = labels["table_img"].y() + tableDims.width * 0.25; 
    
        var half = Math.ceil(theTable.itemsInUse.length / 2);
        var itemHeight = (tableDims.width * 0.75) / (half + 1);
        for (var i = 0; i < theTable.itemsInUse.length; i++) {
            var row = Math.floor(i / half);
            var col = i % half;
            var inRow = row === 0 ? half : theTable.itemsInUse.length - half;
            var margin = (tableDims.width * 0.75 - itemHeight * inRow) / (inRow + 1);
            var dx = tableX + margin * (col + 1) + itemHeight * (col + 0.5);
            var dy = tableY + tableDims.width * 0.5 * row;
            drawItemButton(theTable.itemsInUse[i], dx, dy, itemHeight / cvH);
        }
		buttons[constants.moves.PASS].draw();
	}

	// Draw players
    var padRad = 0.045 * cvW;
	var playerRad = tableDims.width * 0.5 + padRad * 1.05;
	var tableX = tableDims.left + tableDims.width / 2;
	var tableY = tableDims.top + tableDims.width / 2;
	var angle = 180; 
	var delta = 360 / numPlayersAtTable(); 

	for (var player of theTable.players) {
		if (player.isDemon && gameState !== constants.states.END) continue;
		var rad = Math.PI * angle / 180;
		var x = tableX - Math.sin(rad) * playerRad;
		var y = tableY + Math.cos(rad) * playerRad;
		drawPlayerPad(player, x, y, padRad);
		angle = (angle + delta) % 360;
	}
}

function drawItemButton(item, x, y, size) {
	var num = Math.max(0, theTable.resources[item] || 0);
	if (!num) buttons[item].disable().show();
	buttons[item].setPosition(x, y).setDims(false, size).setBackground(BUTTON_BACKGROUND).setMargin(10 * r).draw();
	new Label(`${num} x `, 12).setPosition(x - size * 0.075 * cvW, y - size * 0.275 * cvH).setAbsolute(true).setColor(buttons[item].textColor()).setAlign("right").draw();
	if (thePlayer.isDemon) drawCircle(interfereUses[item] > 0 ? "green" : "red", x - size * 0.2 * cvW, y + size * 0.3 * cvH, 5 * r);
}

function drawDemonSalt(xStart, yTop, yBot, padRad, margin) {
	if (theTable.saltLine.start === undefined) return;
	
	// Track salt line groupings, so we can display what the result will be to demon.
	var groupRed = [false, false];
	var saltBreaks = [0];
	var startGroup = theTable.saltLine.start < theTable.saltLine.end ? 1 : 0;
	var currGroup = startGroup;

	var saltIndex = 0;
	for (var i = 0; i < numPlayersAtTable(); i++) {
		if (theTable.players[i].isDemon) continue;

		groupRed[currGroup] |= possessedPlayers.includes(theTable.players[i].id);
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
	saltBreaks.push(numPlayersAtTable());
	// Draw block
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
	var delta = 360 / numPlayersAtTable();

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

	if (theTable.currentMove.playerId !== thePlayer.id) return;

	var tableRad = labels["table_img"].dims().width / 2;
	var tableX = labels["table_img"].x() + tableRad;
	var tableY = labels["table_img"].y() + tableRad;
	var delta = 360 / numPlayersAtTable();
	var angle = 180 + delta / 2;

	for (var i = 0; i < numPlayersAtTable(); i++) {
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
	if (player.isDamned || (thePlayer.isDemon && possessedPlayers.includes(player.id)) || (thePlayer.id === player.id && thePlayerIsPossessed)) {
		pent = IMAGES[PENTAGRAM];
	}
	if (player.wasDemon) pent = IMAGES[PENTAGRAM_RED];
	drawImage(pent, x, y, rad * 2 / cvW, false, true, true);
	drawCircle(player.color, x, y, rad * 0.78);

	// Move player avatar/button to position.
	buttons[player.id].setPosition(x - rad * 0.25,  y - rad * 0.1);
	buttons[player.id].width = rad * 1.5 / cvW;
	buttons[player.id].on_img = PLAYER_IMAGES[player.avatarId];
	// Enable button for the demon, and for player selecting another player for a move.
	buttons[player.id].enabled = (thePlayer.isDemon && !(possessedPlayers.includes(player.id) || player.id === smudgedPlayer || player.isPurified || player.wasPurified)) || (gameState === constants.states.SELECT && theTable.currentMove.playerId === thePlayer.id && player.id !== thePlayer.id);
	buttons[player.id].visible = true;
	buttons[player.id].draw();
	
	if (player.isExorcised) drawImage(IMAGES[constants.items.EXORCISM], x - rad * 0.25, y - rad * 0.2, false, rad * 0.8 / cvH, true, true);
	if (player.isSmudged) drawImage(IMAGES[BURNING_SMUDGE], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (player.wasSmudged && !player.isSmudged) drawImage(IMAGES[BURNED_SMUDGE], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (thePlayer.isDemon && player.isSmudged && player.id !== smudgedPlayer) drawImage(IMAGES[FAIL_X], x - rad * 0.55, y + rad * 0.15, false, rad * 0.4 / cvH, true, true);
	if (player.isPurified || player.wasPurified) drawImage(IMAGES[constants.items.WATER], x + rad * 0.1, y + rad * 0.15, false, rad * 0.5 / cvH, true, true);

	// Draw name
	drawImage(IMAGES[NAMEPLATE], x, y + rad * 0.6, rad * 1.6 / cvW, false, true, true);
	drawText(player.active ? player.name : `< ${player.name} >`, x, y + rad * 0.7, 15, undefined, true, rad * 1.4, 5, player.active ? "black" : "gray");
	// Draw start player and current player indicators
	if (theTable.currentPlayer !== undefined && player.id === getCurrentPlayer().id) drawCircle("green", x - rad * 0.68, y + rad * 0.47, r * 3);
	if (theTable.startPlayer !== undefined && player.id === theTable.players[theTable.startPlayer].id) drawCircle("blue", x - rad * 0.68, y + rad * 0.75, r * 3);

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

function drawTimers() {
	if (!theTable) return;
	// Update timers
	var anyTimer = false;
	for (var timer in theTable.timers) {
		if (theTable.timers[timer]) {
			if (theTable.paused) {
				labels[timer].text = utils.formatSec(Math.floor((theTable.timers[timer] - theTable.pauseTime) / 1000));
				drawGroups[timer].enable();
			} else if (theTable.timers[timer] >= ts.now()) {
				labels[timer].text = utils.formatSec(Math.floor((theTable.timers[timer] - ts.now()) / 1000));
				drawGroups[timer].enable();
			}
			anyTimer = true;
		} else {
			drawGroups[timer].disable();
		}
	}
	if (anyTimer && isTableOwner()) buttons["pause"].enable().draw();
    // If turn order is on, round timer is always off, but we still want round number.
    if (theTable.settings.turnOrder && theTable.round) labels["round timer title"].enable();
	drawGroups["timers"].draw();
}