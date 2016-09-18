/**
Copyright 2016 Valentin Kuba, Sebastian Schmid and Michael Troger <https://github.com/michaeltroger/shribe>
This file is part of Shribe.

Shribe is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Shribe is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Shribe.  If not, see <http://www.gnu.org/licenses/>.
*/
// set up
// get all the tools we need
require('newrelic');                        // for monitoring server/app
var enforce = require('express-sslify'); // for forcing https connections
var express     = require('express');       // web framework for building web applications
var app         = express();
var ip          = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port        = process.env.OPENSHIFT_NODEJS_PORT || 8080; // get the already configured port or define 3000 if not defined yet
var mysql       = require('mysql');         // for handling mysql databases
var passport    = require('passport');      // middleware for authentication
var flash       = require('connect-flash');

var http = require('http').Server(app);     // http server

var nodemailer = require('nodemailer');                       // set up email
var emailConfig    = require('./config/email');
var transporter = nodemailer.createTransport(emailConfig);   // create reusable transporter object using SMTP transport

var morgan       = require('morgan');       // just for developing -> logs every http request
var cookieParser = require('cookie-parser');// read cookies (needed for auth)
var bodyParser   = require("body-parser");  // get information from html forms
var expressSession = require('express-session'); // for creating sessions

var bcrypt          = require('bcrypt-nodejs');     // password encryption

var redisStore = require('connect-redis')(expressSession); // a key value store for saving session data
var redisConfig = require("./config/redis");              // the connection parameters to the redis DB
var sessionConfig = {        // the session is used by the express/http server AND the websocket server -> therefore middleware
    name: "shribe", // default 'connect.sid'
    secret: "so urgeil geheim",
    resave: true,
    saveUninitialized: false,
    store: new redisStore(redisConfig),
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h: if not specified -> session cookie which ends when browser closed
};
var sessionMiddleware = expressSession(sessionConfig);
if (sessionConfig.store) {
    console.log("using REDIS DB for session storage");
} else {
    console.log("ATTENTION: using memory for session storage (will be lost on server restart)");
}

// connect to mysql database
var configDB    = require('./config/database');
console.log("connected with database host: " + configDB.host);
var connection  = mysql.createConnection(configDB);
connection.connect();

require('./config/passport')(passport, connection, transporter, bcrypt);     // pass passport for configuration

// set up our express application

/*
// redirect rhcloud domain to top level domain
function domainRedirect(req, res, next) {
    if (req.get('host') == 'lets-shribe.rhcloud.com') {

        return res.redirect(301, req.protocol + '://' + 'shri.be' + req.originalUrl);
    }
    next();
}
app.use(domainRedirect);

// redirect www request to urls w/o www
function wwwRedirect(req, res, next) {
    if (req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
}
app.set('trust proxy', true);
app.use(wwwRedirect);

// force https
app.use(enforce.HTTPS({ trustProtoHeader: true }));
 */


//app.use(morgan('dev'));                     // log every request to the console -> just for developing/debugging
app.use(cookieParser());                      // read cookies (needed for auth)
app.use(bodyParser.json());                  // get information from html forms
app.use(bodyParser.urlencoded({
    extended: true
}));


// required for passport
app.use(sessionMiddleware); // session secret, makes sure cookies can't be manipulated on client side
app.use(passport.initialize());
app.use(passport.session());                      // persistent login sessions
app.use(flash());                                 // use connect-flash for flash messages stored in session


app.set('view engine', 'ejs');                     // set up EJS as template engine



// routes
require('./routes/routes.js')(app, express, passport, connection,  bcrypt); // load our routes and pass in our app and fully configured passport

require('./chat/sockets').listen(http, connection, sessionMiddleware, transporter); // websocket server -> the chat itself


// finally launch web server
http.listen(port, ip, function(){
    console.log('listening on *:' + port);//
});

