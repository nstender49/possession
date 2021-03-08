require("dotenv").config();

var DEBUG = process.env.NODE_ENV === "development";

var express = require("express");
var app = express();

const db = require("./db");

const session = require("express-session");
const KnexSessionStore = require('connect-session-knex')(session);

const store = new KnexSessionStore({
	knex: db
});

var expressSession = session({
	secret: process.env.COOKIE_SECRET,
	cookie: {
		sameSite: true,
		// TODO: enable this once https is enabled, need hobby level heroku
		// secure: DEBUG ? false : true,  
		maxAge: 24 * 60 * 60 * 1000,
	},
	// TODO: take a second look at these.
	saveUninitialized: true,
	resave: true, 
	store: store,
});
app.use(expressSession);

var server = require("http").Server(app);

var socketio = require("socket.io");
var io = socketio(server);
const SharedSession = require("express-socket.io-session");
io.use(SharedSession(expressSession, {
    autoSave:true
})); 

const Lobby = require("./libs/lobby");
var lobby = new Lobby(io, db);
lobby.restore().then(lobby.listen());

app.set("port", process.env.PORT);
app.use(express.static("public"));  // Staticly serve pages, using directory 'public' as root 

var timesyncServer = require("timesync/server");
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
