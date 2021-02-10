(function(exports){
    exports.title = function(s) {
        return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
    }

    exports.formatSec = function(sec) {
        var min = Math.floor(sec / 60);
        var sec = sec % 60;
        return (min ? `${min}m` : "") + ((sec || !min) ? `${sec.toString().padStart(2, "0")}s` : "");
    }

    
    exports.removeByValue = function(arr, val) {
        var index = arr.indexOf(val);
        if (index == -1) return undefined;
        return arr.splice(index, 1)[0];
    }

})(typeof exports === 'undefined'? this['utils']={}: exports);