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

module.exports = function(app, express, passport, connection, bcrypt) {
    /**
    // homepage
    app.get('/', function (req, res) {
       res.render('pages/index.ejs'); // load the index.ejs template file
    });
    */


    // show the login form
    app.get('/', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.render('pages/login.ejs', { message: req.flash('loginMessage') });
    });

    // make the chat only available for authenticated users
    app.get('/chat', isLoggedIn, function (req, res) {
        res.render('pages/chat.ejs');
    });

    // for https certificate verification
    app.get('/.well-known/acme-challenge/*', function (req, res) {
        res.header("Content-Type", "text/plain");
        res.sendfile("public"+req.originalUrl);
    });

    app.get('/time.manifest', function (req, res) {
        res.header("Content-Type", "text/cache-manifest");
        res.sendfile("public/time.manifest");
    });

    // process the login form
    app.post('/', passport.authenticate('local-login', {
        successRedirect : '/chat', // redirect to the secure profile section
        failureRedirect : '/', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // show the signup form
    app.get('/signup', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.render('pages/signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
   app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/registered', //'/profile', // redirect to the secure profile section
        failureRedirect: '/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // PROFILE SECTION
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/profile', isLoggedIn, function(req, res) {
        res.render('pages/profile.ejs', {
            user: req.user // get the user out of session and pass to template
        });
    });

    app.get('/verify',function(req,res){
        console.log(req.query.id);

        var emailAddressDecoded = new Buffer(req.query.u, 'base64').toString('ascii');

        connection.query("SELECT active FROM user WHERE email=?", emailAddressDecoded, function(err, rows, fields) {
            if (err) return done(err);  // if there are any errors, return the error before anything else

            if (rows.length) {
                console.log("email decoded: " + emailAddressDecoded);
                console.log(rows[0].active);

                if(req.query.id  == rows[0].active ) {
                    console.log("email is verified");
                    //res.end("<h1>Email is been Successfully verified</h1>");

                    res.redirect('/');

                    connection.query("UPDATE user SET active = NULL WHERE email=?", emailAddressDecoded, function(err, rows, fields) {
                        if (err) return done(err);  // if there are any errors, return the error before anything else

                    });
                }
                else {
                    console.log("email is not verified");
                    res.end("<h1>Bad Request</h1>");
                }

            } else {
                console.log("email address not found in DB");
                res.end("<h1>Email address not found in DB</h1>");
            }

        });

    });


    app.get('/registered', isLoggedIn, function(req, res) {
        res.render('pages/registered.ejs', {
          //  user: req.user // get the user out of session and pass to template
        });
    });

   // LOGOUT
    app.get('/logout', function(req, res) {
        req.logout();
        //req.session.destroy();
        res.redirect('/');
    });

    // example for showing that it's also possible to return just text, no html file
    app.get('/test/', function(req, res) {
        res.send("test");
    });

    // for getting client access to public folder: for example for css files
    // returns the files how they are - like apache
    app.use('/files/', express.static('public'));

    //The 404 Route (ALWAYS Keep this as the last route)
    app.get('*', function(req, res){
        res.render('pages/404.ejs');

        //res.status(404).send("Page not found");
        //res.send('404 - Page not found', 404); // deprecated
    });
};

// route middleware to make sure a user is logged in
// As with any middleware it is quintessential to call next()
//if the user is authenticated
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/'); // redirect to login if not authenticated
};

