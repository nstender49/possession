(function(exports){

    // your code goes here

   exports.states = {
        INIT: "init",
        MAIN_MENU: "main menu",
        LOBBY: "lobby",
        DEMON_SELECTION: "demon selection",
        NIGHT: "night",
        DISCUSS: "discuss",
        DAY: "day",
        SECONDING: "seconding",
        VOTING: "voting", 
        SELECT: "selecting player",
        INTERFERE: "demon interference",
        INTERPRET: "interpret",
        DISPLAY: "display",
        END: "game over",
    };

    exports.moves = {
        BEGIN: "BEGIN",
        ACCEPT_DEMON: "ACCEPT_DEMON",
        READY: "READY",
        SECOND: "SECOND",
        VOTE: "VOTE",
        USE_ITEM: "USE_ITEM",
        PASS: "PASS",
        SELECT: "SELECT",
        INTERFERE: "INTERFERE",
        INTERPRET: "INTERPRET",
        FINISH: "FINISH",
    };

    exports.items = {
        BOARD: "BOARD",
        WATER: "WATER",
        ROD: "ROD",
        EXORCISM: "EXORCISM",
        SALT: "SALT",
        SMUDGE: "SMUDGE",
    };

    exports.times = {
        ROUND: "ROUND",
        DISCUSS: "DISCUSS",
        TURN: "TURN",
        SECOND: "SECOND",
        VOTE: "VOTE",
        SELECT: "SELECT",
        INTERFERE: "INTERFERE",
        INTERPRET: "INTERPRET",
    };

    exports.timers = {
        ROUND: "ROUND",
        MOVE: "MOVE",
    };

    exports.PLAYER_COLORS = [
        "#fbb7c5",
        "#8dd304",
        "#0089cc",
        "#98178e",
        "#ed6e01",  
        "#a37e30",
        "#ed2c34",
        "#144c2a",
        "#0046b6",
        "#512246",
        "#fdc918", 
        "#4c270c",
        "#000000",
        "#ffffff",
    ];

    exports.AVATAR_COUNT = 50;

})(typeof exports === 'undefined'? this['constants']={}: exports);