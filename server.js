require("dotenv").config();

var ENV = process.env.NODE_ENV || "dev";
var DEBUG = process.env.NODE_ENV === "dev";

var express = require("express");
var socketio = require("socket.io");
var timesyncServer = require("timesync/server");

const Lobby = require("./libs/lobby");

var app = express();
var session = require("express-session")({
	secret: process.env.COOKIE_SECRET,
	cookie: {
		sameSite: true,
		// TODO: take a second look at these.
		saveUninitialized: false,
		resave: true, 
		// TODO: enable this once https is enabled, need hobby level heroku
		// secure: DEBUG ? false : true,  
		maxAge: 24 * 60 * 60 * 1000,
	},
});
var sharedsession = require("express-socket.io-session");

app.use(session);

var server = require("http").Server(app);
var io = socketio(server);
io.use(sharedsession(session, {
    autoSave:true
})); 

var lobby = new Lobby(io);
lobby.listen();

app.set("port", process.env.PORT);
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
