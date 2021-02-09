function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].sessionId === playerId;
}

function demonAtTable() {
    if (!gameState) return false;
    return [constants.states.LOBBY, constants.states.DEMON_SELECTION, constants.states.END].includes(gameState);
}

function numPlayersAtTable() {
    if (!theTable) return 0;
    return theTable.players.length - (demonAtTable() ? 0 : 1);
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