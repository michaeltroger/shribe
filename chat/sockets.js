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
// global variables
var socketio = require('socket.io'),// websocket implementation
    users = {},                     // all online users with their sockets    --> INDEX = IDUSER <--
    conversations = {},             // includes all moods of all current online user's conversations    --> INDEX = IDCONVERSATION  <--

    defColor = '47747F',           // define default values
    defImportance = 1,
    defMood = 0,
    textLengthEmoticon = 10,
    textLengthLocation = 30,
    textLengthEvent = 30,
    textLengthImage = 20,
    maxMood = 10,
    minMood = -10,
    loadingLimit = 5;               // the limit of how many messages to load on loadConversation

module.exports.listen = function(app, connection, sessionMiddleware, transporter) {
    var io = socketio.listen(app);                                                // start the socket server
    io.use(function(socket, next) {
        sessionMiddleware(socket.request, {}, function() { // request / response / callback
                if (socket.request.session.passport && socket.request.session.passport.user) { // only connect to socket if user variable is found in cookie
                    next();
                }
        });
    }) // only proceed if the user is authenticated (session-cookie)
        .on('connection', function(socket){                                       // when the user finally has a socket connection with the server

        var // local variables
            iduser,                              // my own user ID
            importances = [],                    // how important my friends are to me    --> INDEX = IDCONVERSATION  <--

            // local functions
            login,                               // initializing chat, is called on socket connection
            calcImportance,                      // calculate and send the new importance to me and friend
            sendOnlineStatusToAllOnlineFriends,  // send my online status to all of my friends
            getUserIDfromConversation,           // get the user id from the conversation ID
            calcSendMood,                        // calculate the mood of the conversation and send it to me and to friend
            saveImportancesInDB,                 // save the importances in the DB for each of your contacts
            seenStatus,                          // write seen status of message/conversation to DB
            conversationOpenedAtPartner,         // check if the conversation is your conversation is opened at partner

            // local event handlers
            loadContacts,                       // loading and sending  all contacts of this user with the associated information like importance, name
            loadConversation,                   // loads and sends a specific conversations, is also used for loading older messages in a conversation
            sendMessage,                        // send a message with given type to friend
            image,                              // send image to friend
            newColor,                           // send new conversation color to friend
            addContact,                         // add contact with given email to your contacts
            blockContact,                       // block or unblock the given conversation
            sendShribing,
            logout;                             // log this user out

//---------------------------------------------------------------------------------------------------------------
        sendOnlineStatusToAllOnlineFriends = function (online) {    // send my online status to all of my friends
//---------------------------------------------------------------------------------------------------------------
            for(var i = 0; i < socket.contacts.length; i++) {
                if (socket.contacts[i].iduser in users) {           // is the current friend online? then send him status, otherwise ignore
                    var json = {
                        online: online,
                        idconversation: socket.contacts[i].idconversation
                    };
                    console.log("sending online status to user " + socket.contacts[i].iduser);
                    users[socket.contacts[i].iduser].emit('online status', json);   // send your online status to your friend via socket
                }
            }
        };

//----------------------------------------------------------------------------------
        login = function () {   // initializing chat, is called on socket connection
//-----------------------------------------------------------------------------------
            console.log("logging in...");
            if (iduser in users) {          // if the user is already logged in
                console.log("user "+iduser+" is already logged in on another device");
                users[iduser].disconnect(); // log his old socket connection / 1. device out
                // and start logging in with the new socket
            }

            socket.iduser = iduser;     // save its user id in the socket variable
            users[iduser] = socket;     // save the user's socket in the global array

            // ask the database for the users username and its email address
            connection.query("SELECT name, email FROM user where iduser=?", iduser, function(err, rows, fields) {
                if (err) throw err;
                socket.username = rows[0].name;
                socket.email = rows[0].email;
                console.log(socket.username + "(ID"+iduser+") logged in");

                socket.emit('login', {                                  // send the user its own username
                    iduser: iduser,
                    name: socket.username
                });
            });

        };

//--------------------------------------------------------------------------------------------------------------------------------
        loadContacts = function () {    // loading all contacts of this user with the associated information like importance, name
//--------------------------------------------------------------------------------------------------------------------------------
            console.log("loading contacts for ID" + iduser);

            // get the conversations your are in
            connection.query("SELECT conversation.idconversation, user.iduser, name, email, lasttime_online, cids.importance, color, mood, cids.blocked, cids.seen " +
            "FROM user, user_conversation, conversation, (SELECT idconversation, importance, blocked, seen " +
            "FROM user_conversation WHERE iduser = "+connection.escape(iduser)+") " +
            "AS cids " +
            "WHERE user.iduser = user_conversation.iduser " +
            "AND user_conversation.idconversation = conversation.idconversation " +
            "AND user_conversation.idconversation = cids.idconversation " +
            "AND user_conversation.iduser !="+connection.escape(iduser), function(err, rows, fields) {
                if (err) throw err;
                   var contacts = [],           // my friends
                       blockedContacts = [],    // the contacts i have blocked
                       blockedByContacts = [];

                    for(var i = 0; i < rows.length; i++) {          // go over all results
                        if (rows[i] && rows[i].idconversation) {
                            var online = false;
                            if (rows[i].iduser in users) {          // if the current friend is online (in the global variable) set his status to online as info for his friend
                                online = true;
                            }

                            var json =  {
                                idconversation: rows[i].idconversation,
                                iduser: rows[i].iduser,
                                name: rows[i].name,
                                email: rows[i].email,
                                lasttime_online: rows[i].lasttime_online,
                                color: rows[i].color,
                                importance: rows[i].importance,
                                mood: rows[i].mood,
                                seen: rows[i].seen,
                                blocked: rows[i].blocked,
                                online: online
                            };
                            if(rows[i].blocked == 0) {          // if the user has not blocked this contact
                                contacts.push(json);
                                importances[rows[i].idconversation] =  Math.pow(2,  rows[i].importance);    // save how important my friends are to me in the local variable
                            } else if(rows[i].blocked == 1) {   // a user I have blocked
                                blockedContacts.push(json);
                            } else if(rows[i].blocked == 2) {   // if I'm blocked by a user
                                blockedByContacts.push(json);
                            }
                            conversations[rows[i].idconversation] = rows[i].mood;                       // save the moods of all the user's conversations in the global variable

                        } // END if
                    } // END FOR LOOP

                    socket.contacts = contacts;                 // save all of my friend's data
                    socket.blockedContacts = blockedContacts;    // save all my blocked contacts
                    socket.blockedByContacts = blockedByContacts; // save the user that blocked me
                    socket.emit('load contacts', contacts);     // send the user its contacts and its blocked contacts
                    socket.emit('load blocked contacts', blockedContacts);

                    sendOnlineStatusToAllOnlineFriends(true);   // send an event to your friends that you're online!
            }); // SQL query END
        };  // loadContacts END

//---------------------------------------------------------------------------------------------------------------------------------------------
        loadConversation = function(idconversation, idmessage){ // idmessage is optional, if not given it is the first load of the conversation
//---------------------------------------------------------------------------------------------------------------------------------------------
            console.log("loading ID conversation " + idconversation);
            var query ="";
            var eventName = "";

            if (!idmessage) {   // loading messages
                query = "SELECT message.idmessage, message.iduser, content.idcontent, content.type, content.value, content.time, image.data " +
                "FROM (SELECT * FROM message WHERE idconversation = "+connection.escape(idconversation)+" ORDER BY idmessage DESC LIMIT "+loadingLimit+") AS message, content " +
                "LEFT OUTER JOIN image ON content.idcontent = image.idcontent " +
                "WHERE message.idmessage = content.idmessage " +
                "ORDER BY content.idcontent ASC";
                console.log("loading messages for the first time");
                eventName = "load conversation";
            } else {            // loading older messages
                query =" SELECT message.idmessage, message.iduser, content.idcontent, content.type, content.value, content.time, image.data " +
                "FROM (SELECT * FROM message WHERE idconversation = "+connection.escape(idconversation)+" AND idmessage < "+connection.escape(idmessage)+
                " ORDER BY idmessage DESC LIMIT "+loadingLimit+") AS message, content " +
                "LEFT OUTER JOIN image ON content.idcontent = image.idcontent " +
                "WHERE message.idmessage = content.idmessage " +
                "ORDER BY content.idcontent ASC";
                console.log("loading older messages");
                eventName = "load older";
            }

            connection.query(query, function(err, rows, fields) {
                if (err) throw err;

                if(rows.length) {                           // if there has been an result
                    var messages = [];                      // save all messages of the wished conversation
                    for(var i = 0; i < rows.length; i++) {  // go over all messages
                        var json = {
                            idmessage: rows[i].idmessage,
                            iduser: rows[i].iduser,
                            idcontent: rows[i].idcontent,
                            type: rows[i].type,
                            value: rows[i].value,
                            time: rows[i].time
                        };

                        if(rows[i].data) {              // if it is a image, save binary data in value
                            json.value = rows[i].data;
                        }

                        messages.push(json);            // add the current message
                    }   // END for loop
                } // END if

                console.log("sending conversation " + idconversation);
                socket.openConversationID = idconversation;             // save the current open conversation of the user in the variable
                socket.emit(eventName, {                                // finally send the conversation to the user
                    idconversation: idconversation,
                    messages: messages
                });

            }); // END query

            if(!idmessage) { // update only while loading the conversation for the first time
                // mark the conversation as read
                connection.query("UPDATE user_conversation SET seen = CURRENT_TIMESTAMP WHERE iduser = "+connection.escape(iduser)+" AND idconversation = "+connection.escape(idconversation) , function(err, rows, fields) {
                    if (err) throw err;
                    console.log("conversation "+idconversation + " marked as read by "+ iduser);
                });
            }

        }; // end function

//--------------------------------------------------------------------------------------------------------
        getUserIDfromConversation = function(idconversation) { // get the user id from the conversation ID
//--------------------------------------------------------------------------------------------------------
            var iduserToSendTo;
            for (var i = 0; i < socket.contacts.length; i++) {
                if (socket.contacts[i].idconversation == idconversation) {
                    //console.log(users[iduser].contacts[i]);
                    iduserToSendTo = socket.contacts[i].iduser;
                }
            }
            return iduserToSendTo;
};



//---------------------------------------------------------------------------------------------------------------------------------
        calcSendMood = function(idconversation, value) {  // calculate the mood of the conversation and send it to me and to friend
//---------------------------------------------------------------------------------------------------------------------------------
            if (idconversation in conversations) {
                console.log("old mood status of conversation " + idconversation+ " is " + conversations[idconversation]);
                switch(value) { // switch the type of smiley
                    case "laugh":
                        conversations[idconversation]+= 4;
                        break;
                    case "smile":
                        conversations[idconversation]+= 2;
                        break;
                    case "neutral":
                        break;
                    case "frown":
                        conversations[idconversation]-= 2;
                        break;
                    case "cry":
                        conversations[idconversation]-= 4;
                        break;
                    default:
                }

                if (conversations[idconversation] > maxMood) {   // if the mood is already bigger or smaller than allowed
                    conversations[idconversation] = maxMood;
                } else if (conversations[idconversation]< minMood) {
                    conversations[idconversation] = minMood;
                }

                var json = {
                    idconversation:   idconversation,
                    mood: conversations[idconversation]
                };

                var friendsID = getUserIDfromConversation(idconversation);
                if (friendsID in users) {                       // if your friend is online...
                    users[friendsID].emit('mood', json);        // send your friend the new mood of the conversation
                }
                socket.emit('mood', json);                      // send the new mood to yourself
                console.log("new mood status of conversation " + idconversation+ " is " + conversations[idconversation]);

                connection.query("UPDATE conversation SET mood ="+connection.escape(conversations[idconversation])+" WHERE idconversation=?", idconversation ,  function (err, rows) {
                    if (err) throw err;
                }); // END query
            }  // END if
        }; // END function

//--------------------------------------------------------------------------------------
        sendMessage = function(msg, type) {  // send a message with given type to friend
//--------------------------------------------------------------------------------------
                    console.log("server received new message type " + type +" from: " + socket.username + " (ID"+iduser+")");
                    console.log(msg);

                    var iduserToSendTo = getUserIDfromConversation(msg.idconversation);
                    console.log("id of friend: " + iduserToSendTo);

                    if (iduserToSendTo in users) {                         // is the friend online?
                        users[iduserToSendTo].emit(type, msg);             // then send him the message via socket
                        console.log('message sent to user ' + iduserToSendTo);
                    } else {
                        console.log("friend " + iduserToSendTo + " is offline!");
                    }

                    if (!iduserToSendTo) {
                        console.log("user is NOT in your contacts");
                    } else
                    { // save entry to database
                        // get the latest message
                        connection.query("SELECT message.idmessage, message.iduser, content.time FROM message, " +
                        "content WHERE (message.idmessage) IN (SELECT MAX(message.idmessage) " +
                        "FROM message WHERE idconversation = ?) " +
                        "AND message.idmessage = content.idmessage " +
                        "ORDER BY content.time LIMIT 1", msg.idconversation, function (err, rows) {
                            if (err) throw err;

                            // check if message date is today
                            if(rows.length != 0) {
                                var checkDate = new Date();
                                var lastMessageToday = (checkDate.toDateString() === rows[0].time.toDateString());
                            }

                            // if the other user sent the last message or there is no message yet or the last message was not sent today
                            if (rows.length == 0 || rows[0].iduser != iduser || !lastMessageToday) {
                                // create new message
                                connection.query("INSERT INTO message (idconversation, iduser) VALUES (" + connection.escape(msg.idconversation) + ", ?)", iduser, function (err2, rows2) {
                                    if (err2) throw err2;

                                    console.log('New message has been created.');
                                    // insert content into new message
                                    connection.query("INSERT INTO content (idmessage, type, value) VALUES (" + rows2.insertId + ", '"+type+"', ?)", msg.value, function (err3, rows3) {
                                        if (err3) throw err3;

                                        console.log('Content added to new message.');
                                    });
                                });
                            // if the current user sent the last message
                            } else if (rows[0].iduser == iduser) {
                                console.log('Last message sent from myself.');
                                // insert content into existing message
                                connection.query("INSERT INTO content (idmessage, type, value) VALUES (" + rows[0].idmessage + ", '"+type+"', ?)", msg.value, function (err2, rows2) {
                                    if (err2) throw err2;

                                    console.log('Content added to message.');
                                });
                            }
                        }); // END QUERY
                    } // END ELSE
        };  // END FUNCTION
//------------------------------------------------------
        image = function(msg) {  // send image to friend
//------------------------------------------------------
            console.log("server received new image from: " + socket.username + " (ID"+iduser+")");
            console.log(msg);
            var iduserToSendTo = getUserIDfromConversation(msg.idconversation);
            console.log("id of friend: " + iduserToSendTo);

            if (iduserToSendTo in users) {                          // is the friend online?
                users[iduserToSendTo].emit('image', msg);           // then send him the image via socket
                console.log('image sent to user ' + iduserToSendTo);
            } else {
                console.log("friend " + iduserToSendTo + " is offline!");
            }

            // TODO DUPLICATE CODE -> first statements are identical to inserting chat message
            if (!iduserToSendTo) {
                console.log("user is NOT in your contacts");
            } else
            { // save entry to database
                // get the latest message
                connection.query("SELECT message.idmessage, message.iduser, content.time FROM message, " +
                "content WHERE (message.idmessage) IN (SELECT MAX(message.idmessage) " +
                "FROM message WHERE idconversation = ?) " +
                "AND message.idmessage = content.idmessage " +
                "ORDER BY content.time " +
                "LIMIT 1", msg.idconversation, function getLatestMessages(err, rows) {
                    if (err) throw err;

                    // check if message date is today
                    var checkDate = new Date();
                    var lastMessageToday = (checkDate.toDateString() === rows[0].time.toDateString());

                    // if the other user sent the last message or there is no message yet or the last message was not sent today
                    if (rows.length == 0 || rows[0].iduser != iduser || !lastMessageToday) {
                        // create new message
                        connection.query("INSERT INTO message (idconversation, iduser) VALUES (" + connection.escape(msg.idconversation) + ", ?)", iduser, function insertIntoMessages(err2, rows2) {
                            if (err2) throw err2;

                            console.log('New message has been created.');
                            // insert content into new message
                            connection.query("INSERT INTO content (idmessage, type, value) VALUES (" + rows2.insertId + ", 'image', 'image')",  function insertIntoContents(err3, rows3) {
                                if (err3) throw err3;

                                console.log('Content added to new message.');
                                console.log("idcontent" + rows3.insertId);
                                connection.query("INSERT INTO image (idcontent, data) VALUES (" + rows3.insertId + ", ?)", msg.value, function insertIntoImage(err4, rows4) {
                                    if (err4) throw err4;

                                    console.log('Image added successfully.');
                                }); // END INSERT INTO IMAGE
                            }); // END INSERT INTO CONTENT
                        });     // END INSERT MESSAGE
                        // if the current user sent the last message
                    } else if (rows[0].iduser == iduser)
                    {
                        console.log('Last message sent from myself.');
                        // insert content into existing message
                        connection.query("INSERT INTO content (idmessage, type, value) VALUES (" + rows[0].idmessage + ", 'image', 'image')", function (err2, rows2) {
                            if (err2) throw err2;

                            console.log('Content added to message.');
                            console.log("idcontent" + rows2.insertId);
                            connection.query("INSERT INTO image (idcontent, data) VALUES (" + rows2.insertId + ", ?)", msg.value, function insertIntoImage(err3, rows3) {
                                if (err3) throw err3;

                                console.log('Image added successfully.');
                            }); // END INSERT INTO IMAGE
                        }); // END INSERT INTO CONTENT
                    } // END ELSE
                }); // END SELECT MESSAGE QUERY
            } // END IF
        }; // END FUNCTION

//--------------------------------------------------------------------------------------------
        addContact = function(enteredEmail){  // add contact with given email to your contacts
//--------------------------------------------------------------------------------------------
            var foundContact = false;

            // check if the entered email is valid
            var testEmail = /^[A-Z0-9._%+-]+@([A-Z0-9-]+\.)+[A-Z]{2,4}$/i;
            if (!testEmail.test(enteredEmail)) {
                console.log("The entered email is not valid!");
                foundContact = true;

                socket.emit('add contact', {
                    errorMessage: "The entered email is not valid!"
                });
            }

            // check if the contact is myself
            if(!foundContact && socket.email == enteredEmail) {
                console.log("You can't add yourself!");
                foundContact = true;

                socket.emit('add contact', {
                    errorMessage: "You can't add yourself!"
                });
            }

            // check if the contact is already in the contact list
            if(!foundContact) {
                for(var i = 0; i < socket.contacts.length; i++) {
                    if (socket.contacts[i].email == enteredEmail) {
                        console.log('User is already in your contacts.');
                        foundContact = true;

                        socket.emit('add contact', {
                            errorMessage: 'User is already in your contacts.'
                        });
                        break;
                    }
                }
            }

            // check if the contact is in your blocked list
            if(!foundContact) {
                for(var i = 0; i < socket.blockedContacts.length; i++) {
                    if (socket.blockedContacts[i].email == enteredEmail) {
                        console.log('User is in your blocked list.');
                        foundContact = true;

                        blockContact(socket.blockedContacts[i].idconversation, false);

                        socket.emit('add contact', {
                            errorMessage: 'User has been unblocked.'
                        });

                        socket.emit('handle block', false);
                        break;
                    }
                }
            }

            // check if you are blocked by your contact
            if(!foundContact) {
                for(var i = 0; i < socket.blockedByContacts.length; i++) {
                    if (socket.blockedByContacts[i].email == enteredEmail) {
                        console.log('You are blocked by this user.');
                        foundContact = true;

                        socket.emit('add contact', {
                            errorMessage: 'You are blocked by this user.'
                        });
                        break;
                    }
                }
            }

            // if the contact is not in the contact list check the database
            if(!foundContact) {
                console.log('User is not in your contacts. Searching in database.');

                //search for the email in the database
                connection.query("SELECT iduser, name, email FROM user WHERE email = ?", enteredEmail, function(err, rows) {
                    // if the contact was found in the database
                    if(rows.length) {
                        console.log('User is already in the database. Adding contact.');

                        // create a new conversation in the database
                        connection.query("INSERT INTO conversation (color, mood) VALUES ('" + defColor + "', ?)", defMood, function(err2, rows2) {
                            // create new user_conversations with the created idconversation
                            connection.query("INSERT INTO user_conversation (iduser, idconversation) " +
                            "VALUES (" + iduser + ", " + rows2.insertId + "), " +
                            "(" + rows[0].iduser + ", " + rows2.insertId + ")", function(err3, rows3) {
                                console.log('Conversation has been created.');

                                var newUserOnline = false;

                                if(rows[0].iduser in users) {
                                    newUserOnline = true;
                                }

                                var newContact = {
                                    idconversation: rows2.insertId,
                                    iduser: rows[0].iduser,
                                    name: rows[0].name,
                                    email: enteredEmail,
                                    lasttime_online: rows[0].lasttime_online,
                                    color: defColor,
                                    importance: defImportance,
                                    mood: defMood,
                                    blocked: false,
                                    online: newUserOnline
                                };
                                console.log(newContact);

                                socket.contacts.push(newContact);

                                socket.emit('add contact', {        // send the new contact's data to myself
                                    contact: newContact
                                });

                                if (newUserOnline) {  // is the friend online?
                                    var otherNewContact = {
                                        idconversation: rows2.insertId,
                                        iduser: iduser,
                                        name: socket.username,
                                        email: socket.email,
                                        lasttime_online: socket.lasttime_online,
                                        color: defColor,
                                        importance: defImportance,
                                        mood: defMood,
                                        blocked: false,
                                        online: true
                                    };

                                    users[rows[0].iduser].contacts.push(otherNewContact);

                                    users[rows[0].iduser].emit('add contact', {
                                        contact: otherNewContact
                                    });         // then send him the new contact via socket
                                } else {
                                    console.log("friend " + rows[0].iduser + " is offline!");
                                }
                            }); //END INSERT INTO USER_CONVERSATION
                        }); //END INSERT INTO CONVERSATION
                    // the contact is neither in the contact list nor the database
                    } else {
                        console.log('User is not in the database. Sending invitation mail.');

                        // setup e-mail data with unicode symbols
                        var mailOptions = {
                            from: 'shribe <shrybe@web.de>', // sender address
                            to: enteredEmail, // list of receivers
                            subject: 'You\'ve been invited to shribe!', // Subject line
                            text: 'Welcome, you\'ve been invited to shribe by ' + socket.username + '!\n\n' +
                            'If you want to join simply go to http://shri.be, login with your email address, choose your password and start to shribe!\n\n' +
                            'See you on shribe!', // plaintext body
                            html: 'Welcome, you\'ve been invited to <a href="http://shri.be"><b>shribe</b></a> by ' + socket.username + '!<br><br>' +
                            'If you want to join simply go to <a href="http://shri.be"><b>shri.be</b></a>, login with your email address, choose your password and start to shribe!<br><br>' +
                            'See you on <a href="http://shri.be"><b>shribe</b></a>!' // html body
                        };

                        // send mail with defined transport object
                        transporter.sendMail(mailOptions, function(error, info){
                            if(error) {
                                socket.emit('add contact', {
                                    errorMessage: 'User is not registered. Error while sending invitation email: ' + error
                                });
                            } else {
                                socket.emit('add contact', {
                                    errorMessage: 'User is not registered. An invitation email has been sent.'
                                });
                            }
                        }); // END TRANSPORTER
                    } // END ELSE
                }); // END SQL QUERY
            } // END IF
        }; // END FUNCTION

//----------------------------------------------------------------------------------------------------
        blockContact = function(idconversation, blockMe) {  // block or unblock the given conversation
//----------------------------------------------------------------------------------------------------
            var blockOther;
            if(blockMe) {
                blockMe = 1;
                blockOther = 2;
            } else {
                blockMe = 0;
                blockOther = 0;
            }
            console.log('blockMe: ' + blockMe + ', blockOther: ' + blockOther);
            connection.query("UPDATE user_conversation SET blocked = '" + blockMe + "' WHERE idconversation = '" + idconversation + "' AND iduser = ?", iduser, function (err, rows) {
                connection.query("UPDATE user_conversation SET blocked = '" + blockOther + "' WHERE idconversation = '" + idconversation + "' AND iduser != ?", iduser, function (err, rows) {
                    console.log('blocked conversation ' + idconversation + " for user " + iduser);
                    var iduserToBlock = getUserIDfromConversation(idconversation);
                    if (iduserToBlock in users) {
                        users[iduserToBlock].emit('got blocked', blockMe);
                    }
                });
            });
        };

//---------------------------------------------------
        sendShribing = function (idconversation) {
//---------------------------------------------------
            var friendsID = getUserIDfromConversation(idconversation);
            if (friendsID in users) {
                users[friendsID].emit('shribing', idconversation);
            }
        };

//---------------------------------------------------
        logout = function (){    // log this user out
//---------------------------------------------------
            //io.emit('chat message', "a user disconnected");
           // if (users[iduser]) {
                connection.query("UPDATE user SET lasttime_online = CURRENT_TIMESTAMP WHERE iduser = ?", iduser, function(err, rows) {
                    console.log('Last time online of user ' + iduser + ' updated.'); // update last time online of myself
                });

                sendOnlineStatusToAllOnlineFriends(false);       // send to friends

                console.log(socket.username +' disconnected');
                delete users[iduser];

            if(socket.contacts.length > 0) {
                saveImportancesInDB();
            }

        };

//--------------------------------------------------------------------------
        newColor = function (msg) { // send new conversation color to friend
//--------------------------------------------------------------------------
            console.log("new color " + msg.color + " for conversation id " + msg.idconversation);

            var friendsID = getUserIDfromConversation(msg.idconversation);
            if (friendsID in users) {
                users[friendsID].emit('color', msg);    // if the friend is online send him the new color
            }
            //socket.emit('color', msg);                // client on the user's side knows the color anyway, not necessary

            connection.query("UPDATE conversation SET color = '"+ msg.color +"' WHERE idconversation = ?", msg.idconversation, function(err, rows) {
                if (err) throw err;
            });

        };
//----------------------------------------------------------------------------------------------------
        saveImportancesInDB = function () { // save the importance in the DB for each of your contacts
//----------------------------------------------------------------------------------------------------
            console.log("saving importance for contacts of user " + iduser);
            //console.log(importances);
            var query = "UPDATE user_conversation SET importance = CASE idconversation ";

            importances.forEach(function(importance, key, array) {
                    query+="WHEN "+key +" THEN " + Math.round(Math.log(array[key]) / Math.log(2))+" ";
            });
            query += "END WHERE iduser="+iduser;


            connection.query(query, function(err, rows) {
                if (err) throw err;
            });

};

//------------------------------------------------------------------------------------------------------------------------
        calcImportance = function (textlength, idconversation) { // calculate and send the new importance to me and friend
//------------------------------------------------------------------------------------------------------------------------
            //importances -> overall textlength of all contacts
            var calcImportanceToSend = [];
            console.log("calc importance for conversation " + idconversation);
            importances.forEach(function(importance, key, array) {
                if (key == idconversation) {
                    // do calculation
                    array[key]+=textlength;
                   // importances[idconversation]

                } else if (array[key] >= 2) { // may not be smaller than 1
                      array[key]--;
                }

                calcImportanceToSend.push({
                    idconversation: key,
                    importance: Math.round(Math.log(array[key]) / Math.log(2))
                });
            });

            console.log(calcImportanceToSend);
            socket.emit('importance', calcImportanceToSend);
        };


//-------------------------------------------------------------------------------------------------
        seenStatus = function (idconversation) { // write seen status of message/conversation to DB
//-------------------------------------------------------------------------------------------------
            // check if my chat partner has our conversation opened
            var iduserPartner = getUserIDfromConversation(idconversation);

            if (conversationOpenedAtPartner(idconversation, iduserPartner)) {
                connection.query("UPDATE user_conversation SET seen = CURRENT_TIMESTAMP WHERE iduser = "+iduserPartner+" AND idconversation = "+connection.escape(idconversation) , function(err, rows, fields) {
                    if (err) throw err;
                    console.log("conversation "+idconversation + " marked as read for "+ iduserPartner);

                });
            } else {
                connection.query("UPDATE user_conversation SET seen = NULL WHERE iduser = "+iduserPartner+" AND idconversation = "+connection.escape(idconversation) , function(err, rows, fields) {
                    if (err) throw err;
                    console.log("conversation "+idconversation + " marked as unread for "+ iduserPartner);

                });
            }

        };

//-----------------------------------------------------------------------------------------------------------------------------------------------------
        conversationOpenedAtPartner = function (idconversation, iduserPartner) { // check if the conversation is your conversation is opened at partner
//-----------------------------------------------------------------------------------------------------------------------------------------------------
            console.log("checking if converation is opened at partner...");
            var opened = false;

            if (iduserPartner in users) {
                //console.log(users[iduserPartner].openConversationID);
                if ( users[iduserPartner].openConversationID == idconversation) {
                    opened = true;
                }
            } else {
                console.log("user "+iduserPartner +" is offline");
            }
            console.log("conversation opened at partner: " + opened);

            return opened;
        };

//--------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------
/*****                REGISTERING EVENT HANDLER:              *****/
//--------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------
        //var passport = socket.request.session.passport; // get the passport object from the session cookie
        //if (passport) {                                 // if there:
            iduser = socket.request.session.passport.user;                     // get the user id from the cookie
            login();                                    // log the user in and send him its username
            loadContacts();                             // load and send contacts to the user

            socket.on('load contacts', loadContacts);
            socket.on('load conversation', loadConversation);
            socket.on('load older', loadConversation);

            socket.on('text', function(data) {
                sendMessage(data, 'text');

                calcImportance(data.value.length, data.idconversation);
                seenStatus(data.idconversation);
            });

            socket.on('emoticon', function(data) {
                sendMessage(data, 'emoticon');

                calcImportance(textLengthEmoticon, data.idconversation);
                calcSendMood(data.idconversation, data.value);
                seenStatus(data.idconversation);
            });

            socket.on('location', function(data) {
                sendMessage(data, 'location');

                calcImportance(textLengthLocation, data.idconversation);
                seenStatus(data.idconversation);
            });

            socket.on('event', function(data) {
                sendMessage(data, 'event');

                calcImportance(textLengthEvent, data.idconversation);
                seenStatus(data.idconversation);
            });

            socket.on('image', function(data) {
                image(data);

                calcImportance(textLengthImage, data.idconversation);
                seenStatus(data.idconversation);
            });

            socket.on('shribing', sendShribing);
            socket.on('add contact', addContact);
            socket.on('block contact', blockContact);
            socket.on('color', newColor);
            socket.on('disconnect', logout);
       // }



    });  // END ON SOCKET CONNECTION
}; // END EXPORT MODULE

