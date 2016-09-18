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
var LocalStrategy   = require('passport-local').Strategy,
bodyParser      = require("body-parser"),       // get information from html forms
createHash;

module.exports = function(passport, connection, transporter, bcrypt) {
  var sendMail;

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
       // console.log("serialize user");
        //console.log(user);
        done(null, user.iduser);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
       // console.log("deserialize user");
        connection.query("SELECT * from user where iduser=?", id, function(err,rows){
            done(err, rows[0]);

        });
    });


    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'email',  // name attributes in html signup
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, email, password, done) { // callback with email and password from our form
            if(email.length > 100) {
                return done(null, false, req.flash('loginMessage', 'The entered email is too long.'));
            } else if(password.length > 200) {
                return done(null, false, req.flash('loginMessage', 'That email is already taken.'));
            }

            // find a user whose email is the same as the forms email
            // we are checking to see if the user trying to login already exists
            connection.query("SELECT * FROM user WHERE email=?", email, function(err, rows, fields) {
                    if (err) return done(err);  // if there are any errors, return the error before anything else

                    // if no user is found, return the message
                    if (!rows.length) {
                        return done(null, false, req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash
                    }

                    // console.log(rows[0]);

                    if(rows[0].active) {   // compare password in the login form with the hashed password in the database
                        return done(null, false, req.flash('loginMessage', 'Oops! Not verified email address yet.')); // create the loginMessage and save it to session as flashdata
                    }
                    // if the user is found but the password is wrong
                     else if(!bcrypt.compareSync(password, rows[0].password)) {   // compare password in the login form with the hashed password in the database
                        return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata
                    }

                    // all is well, return successful user
                    return done(null, rows[0]);
            });

        }));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-signup', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'email',    // name attributes in html signup
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, email, password, done) {
            console.log("html inserted name: " + req.body.name);
            console.log("html inserted email address: " + email);
            console.log("html inserted password: " + password);
            // asynchronous
            // User.findOne wont fire unless data is sent back
            process.nextTick(function() {
                if(req.body.name.length > 30) {
                    return done(null, false, req.flash('signupMessage', 'The entered name is too long.'));
                } else if(email.length > 100) {
                    return done(null, false, req.flash('signupMessage', 'The entered email is too long.'));
                } else if(password.length > 200) {
                    return done(null, false, req.flash('signupMessage', 'The entered password is too long.'));
                }

                // find a user whose email is the same as the forms email
                // we are checking to see if the user trying to login already exists
                connection.query("SELECT email FROM user WHERE email=?", email, function(err, rows, fields) {
                    if (err) return done(err);

                    //console.log(rows.length + " results");

                    if (rows.length) { // if there is already a user registered with this email address

                        //console.log("user " + email + " already registered");

                        return done(null, false, req.flash('signupMessage', 'That email is already taken.'));

                    } else {  // if no user is registered yet

                       // console.log("user " + email + " not registered yet, inserting into database:");

                        var newUser = {
                            name: req.body.name,
                            email: email,
                            password: password
                        };

                        var token = createHash(email);// TODO probably insecure to use email for hashing
                        sendMail(email, token);

                        var post  = {name: req.body.name, email: email, password: createHash(password), active: token};
                        connection.query("INSERT INTO user SET ?", post, function(err, rows) {
                            if (err) throw err;

                            newUser.iduser = rows.insertId;
                           // console.log(newUser);

                            return done(null, newUser); // TODO pass user NOT false
                        });



                    }


                });

            });

        }));



    sendMail = function(emailAddress, token) {
        var emailAddressEncoded = new Buffer(emailAddress).toString('base64');

        var link="<a href='http://shri.be/verify?id="+token+"&u="+emailAddressEncoded+"'>"+ "http://shri.be/verify?id="+token+"&u="+emailAddressEncoded +"</a>";

        // setup e-mail data with unicode symbols
        var mailOptions = {
            from: 'shribe <shrybe@web.de>', // sender address
            to: emailAddress, // list of receivers
            subject: 'Thanks for registration at shribe!', // Subject line
            text: 'Welcome, thanks for registering at shribe!\n\n' +
            'Please verify your email address by following this link: http://shri.be/verify?id='+token+'&email='+emailAddress +'!\n\n' +
            'See you on shribe!', // plaintext body
            html:
            'Welcome, thanks for registering at <a href="http://shri.be"><b>shribe</b></a> <br><br>' +
            'Please verify your email address by visiting the following site:' +
            link+
            '<br><br>' +
            'See you on <a href="http://shri.be"><b>shribe</b></a>!' // html body
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, function(error, info){

        });
    };
// Generates hash using bcrypt
    createHash = function(password){
        return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
    };

};
