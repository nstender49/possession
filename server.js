var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var express = require("express");
var session = require("express-session");
var socketio = require("socket.io");
var timesyncServer = require("timesync/server");

const Lobby = require("./libs/lobby");

var app = express();
app.use(session({
	secret: "cookie secret",
	cookie: {
		sameSite: true,
		// secure: true,  NOTE: enable this once https is enabled, need hobby level heroku
		maxAge: 24 * 60 * 60 * 1000,
	},
}));

var server = require("http").Server(app);
var io = socketio(server);
var lobby = new Lobby(io);
lobby.listen();

app.set("port", (process.env.PORT || 3001));  // Use either given port or 3001 as default
app.use(express.static("public"));  // Staticly serve pages, using directory 'public' as root 
app.use("/timesync", timesyncServer.requestHandler);

// User connects to server
app.get("/", function(req, res) {
	// Will serve static pages, no need to handle requests
});


// If any page not handled already handled (ie. doesn't exists)
app.get("*", function(req, res) {
	res.status(404).send("Error 404 - Page not found");
});

// Start http server
server.listen(app.get("port"), function() {
	console.log("Node app started on port %s", app.get("port"));
});
