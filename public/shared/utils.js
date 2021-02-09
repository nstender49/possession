(function(exports){
    exports.title = function(s) {
        return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
    }

    exports.formatSec = function(sec) {
        var min = Math.floor(sec / 60);
        var sec = sec % 60;
        return (min ? `${min}m` : "") + ((sec || !min) ? `${sec.toString().padStart(2, "0")}s` : "");
    }

})(typeof exports === 'undefined'? this['utils']={}: exports);