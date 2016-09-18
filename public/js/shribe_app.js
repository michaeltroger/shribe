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
var app = (function (google,swal) {
    var socket,
        shribing = false,


    // io.connect('https://mikenet-shribe.rhcloud.com:8443', {'forceNew':true }),
    // constants
        MAX_MESSAGES = 5,
        MAX_FILE_SIZE = 3 * 1024 * 1024, // -> 3 MB
        timeoutNotification = 3000,
        audio = new Audio('/files/sounds/newmessage.mp3'),
        newMessagesCounter = 0,
        windowActive = true,
        newMessageWhileInactive = false,

    // event handlers
        login,              // get my own data from server
        loadContacts,       // store contacts from server in array and display all
        loadBlockedContacts,
        loadConversation,   // check and handle loaded contents
        loadOlderMessages,
        browserNotification,
        playSound,
        vibrate,
        getContent,         // update contact or add content to conversation
        getText,
        getImage,
        getEvent,
        getEmoticon,
        getLocation,
        addContact,         // add new contact from server to array and display it
        blockContact,
        handleBlock,
        gotBlocked,
        updateOnlineStatus, // updates contact and redisplays conversation if necessary
        getMood,            // log mood to console
        getColor,           // update contact with color from server
        getImportance,      // update importances of all contacts
        getShribing,

    // public functions
        openConversation,   // request messages and prepare conversation
        requestOlderMessages,
        sendText,           // add the new message to current conversation and send it to server
        sendImage,          // send an image from file input to server and add it to current conversation
        sendEmoticon,       // send an emoticon to server
        sendEvent,          // send an event to server
        sendLocation,       // send coordinates to server and add map to conversation
        sendAddress,        // send coordinates to server and add map to conversation
        requestNewContact,  // ask server for a new contact by email
        changeColor,        // change color of contact and send it to server
        sendShribing,

    // additional functions
        geocoder,           // for getting coordinates from address
        prepareMessages,    // sort contents into an array
        init;

    // ########## event handlers ##########

    // ----------------------------------------------
    login = function (load) {   // get my own data from server
    // ----------------------------------------------
        console.log('logged in as id' + load.iduser + ' ' + load.name);
        data.setMyData(load.iduser, load.name);
        ui.userInfo();
    };

    // ----------------------------------------------
    loadContacts = function (loadedContacts) {  // store contacts from server in array and display all
    // ----------------------------------------------
        console.log('loadContacts');
        loadedContacts.forEach(data.setContact);
        ui.contactList();
    };

    // ----------------------------------------------
    loadBlockedContacts = function (loadedBlockedContacts) {  // store contacts from server in array and display all
        // ----------------------------------------------
        console.log('loadBlockedContacts');
        ui.blockedContactList(loadedBlockedContacts);
    };

    // ----------------------------------------------
    loadConversation = function (loaded) {  // check and handle loaded contents
        // ----------------------------------------------
        console.log('loadConversation');
        if (!data.isCurrent(loaded.idconversation)) { return; }
        if (loaded.messages && loaded.messages.length) {
            if (loaded.messages.length < MAX_MESSAGES) {
                ui.setConvHeader(false);
            } else {    // only display the load link if it is possible, that there are more messages
                ui.setConvHeader(true);
            }
            var messages = prepareMessages(loaded.messages);
            messages.forEach(function (message) {
                ui.message(true, message.contents, message.idmessage);
            });

            var contact = data.contact(loaded.idconversation);
            if(contact.gotNewMessage) {
                app.newMessagesCounter--;
                ui.changeMessageCounter();
            }
            contact.gotNewMessage = false;
            contact.seen = true;
        } else {
            ui.setConvHeader(false);
        }
        ui.setConversationReady(loaded.idconversation);
    };

    // ----------------------------------------------
    loadOlderMessages = function (loaded) {
    // ----------------------------------------------
        console.log('loadOlderMessages');
        if (!data.isCurrent(loaded.idconversation)) { return; }
        if (loaded.messages && loaded.messages.length) {
            var messages = prepareMessages(loaded.messages);
            messages.reverse();
            messages.forEach(function (message) {
                ui.message(false, message.contents, message.idmessage);
            });
            ui.setConvHeader(true);
            ui.filterMessages('load');
            ui.setConversationReady(loaded.idconversation, loaded.messages[loaded.messages.length - 1].idmessage);
        } else {
            console.log('... no older messages available');
            ui.setConvHeader(false);
        }
    };


    vibrate = function() {
        // enable vibration support
        navigator.vibrate = navigator.vibrate || navigator.webkitVibrate || navigator.mozVibrate || navigator.msVibrate;

        if (navigator.vibrate) {
            navigator.vibrate(500);
        }

    };
    playSound = function () {
        audio.play();
    };
    browserNotification = function(theTitle, theBody, theIcon) {
        var options = {
            body: theBody,
            icon: theIcon
        };

        if (!("Notification" in window)) {
            //swal("This browser does not support desktop notification");
        }

        // Let's check whether notification permissions have already been granted
        else if (Notification.permission === "granted") {
            // If it's okay let's create a notification
            try {
                var notification = new Notification(theTitle, options);//new Notification("Hi there!");
                notification.onshow = function () { // timeout optional for chrome
                    setTimeout(function () {
                        notification.close()
                    }, timeoutNotification)
                };
            } catch (err) {
                console.log("error while trying to create a notification");
            }
        }

        // Otherwise, we need to ask the user for permission
        else if (Notification.permission !== 'denied') {
            Notification.requestPermission(function (permission) {
                // If the user accepts, let's create a notification
                if (permission === "granted") {
                    try {
                        var notification = new Notification(theTitle, options);
                        notification.onshow = function () { // timeout optional for chrome
                            setTimeout(function () {
                                notification.close()
                            }, timeoutNotification)
                        };
                    } catch (err) {
                        console.log("error while trying to create a notification");
                    }
                }
            });
        }

        // At last, if the user has denied notifications, and you
        // want to be respectful there is no need to bother them any more.
    };

    // ----------------------------------------------
    getContent = function (idconversation) {   // update contact or add content to conversation
    // ----------------------------------------------
        playSound();
        vibrate();
        if (data.isCurrent(idconversation)) {
            if(!windowActive && !newMessageWhileInactive && !data.contact(idconversation).gotNewMessage) {
                newMessageWhileInactive = true;
                app.newMessagesCounter++;
                ui.changeMessageCounter();
                $('#contacts-btn').addClass('blink');
            }
            return true;
        } else {
            if(!data.contact(idconversation).gotNewMessage) {
                app.newMessagesCounter++;
                ui.changeMessageCounter();
                $('#contacts-btn').addClass('blink');
            }
            data.contact(idconversation).gotNewMessage = true;
            ui.contactAttributes(data.contact(idconversation));
            return false;
        }
    };

    // ----------------------------------------------
    getText = function (loaded) {
    // ----------------------------------------------
        browserNotification(data.contact(loaded.idconversation).name + " sent a message", loaded.value, "/files/icons/pencil_icon.png");
        if (getContent(loaded.idconversation)) {
            ui.newContent(new msg.Text(loaded.value, new Date(loaded.time), false));
        }
    };

    // ----------------------------------------------
    getImage = function (loaded) {
    // ----------------------------------------------
        browserNotification(data.contact(loaded.idconversation).name + " sent an image", "", "/files/icons/image_icon.png");
        if (getContent(loaded.idconversation)) {
            ui.newContent(new msg.Image(loaded.value, new Date(loaded.time), false));
        }
    };

    // ----------------------------------------------
    getEmoticon = function (loaded) {
    // ----------------------------------------------
        browserNotification(data.contact(loaded.idconversation).name + " sent an emoticon", "", "/files/icons/emoticon_icon.png");
        if (getContent(loaded.idconversation)) {
            ui.newContent(new msg.Emoticon(loaded.value, new Date(loaded.time), false));
        }
    };

    // ----------------------------------------------
    getLocation = function (loaded) {
    // ----------------------------------------------
        browserNotification(data.contact(loaded.idconversation).name  + " sent a location", "", "/files/icons/location_icon.png");
        if (getContent(loaded.idconversation)) {
            ui.newContent(new msg.Location(loaded.value, new Date(loaded.time), false));
        }
    };

    // ----------------------------------------------
    getEvent = function (loaded) {
        // ----------------------------------------------
        browserNotification(data.contact(loaded.idconversation).name  + " sent an event", "", "/files/icons/date_icon.png");
        if (getContent(loaded.idconversation)) {
            ui.newContent(new msg.EventContent(loaded.value, new Date(loaded.time), false));
        }
    };

    // ----------------------------------------------
    addContact = function (load) {    // add new contact from server to array and display it or get status
    // ----------------------------------------------
        if (load.errorMessage) {
            swal(load.errorMessage);
        } else if (load.contact) {
            socket.emit('load contacts');
            //data.setContact(load.contact);
            //ui.contact(load.contact);
            console.log('addContact - added '+ load.contact.idconversation);
        } else {
            console.log('addContact - error: ' + load);
        }
    };

    // ----------------------------------------------
    blockContact = function (idconversation, block) {
    // ----------------------------------------------
        console.log('blocking');
        $('#userOptions').hide();
        $('#convOptions').hide();
        socket.emit('block contact', idconversation, block);
        handleBlock(block);
    };

    // ----------------------------------------------
    handleBlock = function (block) {
        // ----------------------------------------------
        if(block == false) {
            socket.emit('load contacts');
            $('#toggleBlockedContacts + ul').empty();
        } else {
            location.reload();
        }
    };

    // ----------------------------------------------
    updateOnlineStatus = function (status) {    // updates contact and conversation if necessary
    // ----------------------------------------------
        console.log('updateOnlineStatus - user: ' + data.contact(status.idconversation).name);
        data.contact(status.idconversation).online = status.online;
        if (!status.online) { data.contact(status.idconversation).lasttime_online = moment(); }
        ui.contactAttributes(data.contact(status.idconversation));
        if (data.isCurrent(status.idconversation)) { ui.conversation(); }
    };

    // ----------------------------------------------
    getMood = function (loaded) { // log mood to console
    // ----------------------------------------------
        console.log("new mood of conversation "+loaded.idconversation +" is "+loaded.mood);
        data.contact(loaded.idconversation).mood = loaded.mood;
        ui.contactAttributes(data.contact(loaded.idconversation));
        if (data.isCurrent(loaded.idconversation)) { ui.conversation(); }
    };

    // ----------------------------------------------
    getColor = function (loaded) {  // update conversation with color from server
    // ----------------------------------------------
        console.log('getColor - change color of conversation ' + loaded.idconversation);
        data.contact(loaded.idconversation).color = loaded.color;
        ui.contactAttributes(data.contact(loaded.idconversation));
        if (data.isCurrent(loaded.idconversation)) { ui.conversation(); }
    };

    // ----------------------------------------------
    getImportance = function (loaded) { // update importance of all contacts
    // ----------------------------------------------
        loaded.forEach(function (imp) {
            console.log('get importance id' + imp.idconversation);
            data.contact(imp.idconversation).importance = imp.importance;
            ui.contactAttributes(data.contact(imp.idconversation));
        });
    };

    // ----------------------------------------------
    getShribing = function (idconversation) {
    // ----------------------------------------------
        console.log('get shribing');
        if (data.isCurrent(idconversation)) {
            ui.shribing(true);
            setTimeout(function () {
                ui.shribing(false);
            }, 2000);
        }
    };

    // ########## public functions ##########

    // ----------------------------------------------
    openConversation = function (idconversation) {    // request messages and prepare conversation
    // ----------------------------------------------
        console.log('openConversation - loading contents for id ' + idconversation);
        data.setCurrent(idconversation);
        socket.emit('load conversation', idconversation);
        ui.clearMessages();
        ui.conversation();
    };

    // ----------------------------------------------
    requestOlderMessages = function (olderThanId) {
    // ----------------------------------------------
        console.log('requestOlderMessages - older than id ' + olderThanId);
        socket.emit('load older', data.current(), olderThanId);
    };

    // ----------------------------------------------
    sendText = function (value) {     // add the new message to current conversation and send it to server
    // ----------------------------------------------
        if (value) {
            switch (value) {
                case ':D': case ':-D': sendEmoticon('laugh'); break;
                case ':)': case ':-)': sendEmoticon('smile'); break;
                case ';)': case ';-)': sendEmoticon('neutral'); break;
                case ':(': case ':-(': sendEmoticon('frown'); break;
                case ':\'(': case ':\'-(': sendEmoticon('cry'); break;
                default:
                    var content = new msg.Text(value, new Date(), true);
                    socket.emit('text', content.toServer());
                    ui.newContent(content);//
            }
        }
    };

    // ----------------------------------------------
    sendImage = function (file) { // send an image from file input to server and add it to current conversation
    // ----------------------------------------------
       if (file.size < MAX_FILE_SIZE) {

           var reader = new FileReader(); // init file reader for reading images
            console.log('sendImage');
            //When the file has been read...
            reader.onload = function(evt){
                var content = new msg.Image(evt.target.result, new Date(), true);
                socket.emit('image', content.toServer());
                ui.newContent(content);
            };
            //reader.readAsDataURL(file); // read as base64
            reader.readAsArrayBuffer(file); // read as array buffer

       } else {
           swal("File is too big!");
       }
    };

    // ----------------------------------------------
    sendEmoticon = function (value) { // send an emoticon to server
    // ----------------------------------------------
        var content = new msg.Emoticon(value, new Date(), true);
        socket.emit('emoticon', content.toServer());
        ui.newContent(content);
    };

    // ----------------------------------------------
    sendAddress = function(address) { // send coordinates to server and add map to conversation
        // ----------------------------------------------

        geocoder.geocode(
            { address: address },
            function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    console.log('sendAddress');
                    var latLng = {
                        latitude: results[0].geometry.location.lat(),
                        longitude: results[0].geometry.location.lng()
                    };
                    latLng = JSON.stringify(latLng);

                    var content = new msg.Location(latLng, new Date(), true);
                    socket.emit('location', content.toServer());
                    ui.newContent(content);
                } else {
                    swal("Address wasn't found. Error: "+status);
                }
            }
        );

    };

    // ----------------------------------------------
    sendLocation = function() { // send coordinates to server and add map to conversation
    // ----------------------------------------------
        navigator.geolocation.getCurrentPosition(
            // success handler
            function(p) {
                console.log('sendLocation');
                var latLng = {
                    latitude: p.coords.latitude,
                    longitude: p.coords.longitude
                };
                latLng = JSON.stringify(latLng);

                var content = new msg.Location(latLng, new Date(), true);
                socket.emit('location', content.toServer());
                ui.newContent(content);
            },
            // error handler
            function(e) {
                swal("geolocation error: "+ e.code)
            }
        );
    };

    // ----------------------------------------------
    sendEvent = function(momentObject, description) { // send event to server, gets a moment.js object and a string as event decription
        // ----------------------------------------------
        //console.log(momentObject);
        if (momentObject && momentObject.isValid()  && description) { // check if a date has been picked, if it is valid and if there is a description

            console.log('sendEvent');

            var event = {
                date: momentObject.format(), // get a iso formatted string of the date
                text: description
            };
            event = JSON.stringify(event);
            console.log(event);

            var content = new msg.EventContent(event, new Date(), true);
            socket.emit('event', content.toServer());
            ui.newContent(content);

        } else {
            swal("pick a valid date and enter a event description");
        }

    };

    // ----------------------------------------------
    requestNewContact = function (email) {   // ask server for a new contact by email
    // ----------------------------------------------
        if(email) {
            socket.emit('add contact', email);
            console.log('requestNewContact - email sent to server');
        }
    };

    // ----------------------------------------------
    changeColor = function (value) { // change color of conversation and send it to server
    // ----------------------------------------------
        socket.emit('color', {
            idconversation: data.current(),
            color: value
        });
        data.currentContact().color = value;
        ui.contactAttributes(data.currentContact());
        ui.conversation();
    };

    // ----------------------------------------------
    sendShribing = function () {
    // ----------------------------------------------
        console.log('send shribing');
        if (!shribing) {
            shribing = true;
            socket.emit('shribing', data.current());
            setTimeout(function () {
                shribing = false;
            }, 3000);
        }
    };

    // ########## other functions ##########

    // ----------------------------------------------
    prepareMessages = function (contents) { // sort contents into an array
    // ----------------------------------------------
        var messages = [];
        contents.forEach(function (content) {
            var newContent = msg.contentByType(content.type, content.value, new Date(content.time), data.amI(content.iduser));

            if (!messages[content.idmessage]) {
                messages[content.idmessage] = {
                    idmessage: content.idmessage,
                    contents: [newContent]
                };
            } else {
                messages[content.idmessage].contents.push(newContent);
            }
        });
        return messages;
    };

    // ----------------------------------------------
    gotBlocked = function (block) {
    // ----------------------------------------------
        if(block == 0) {
            block = false;
        } else {
            block = true;
        }
        handleBlock(block);
    };

    // ----------------------------------------------
    init = function () {    // initialize jquery objects and set event handlers
    // ----------------------------------------------
        geocoder = new google.maps.Geocoder(); // needed for calculating address to coordinates

        if ('Notification' in window) {
            Notification.requestPermission(); // request permission for notifications
        }

        if(window.location.host === "localhost:8080")
        {
            console.log("working with local version");
            socket = io({'forceNew':true });
        }
        else
        {
            console.log("working with web version!");

            socket = io.connect('https://lets-shribe.rhcloud.com:8443', {'forceNew':true });

            //console.log('check 1', socket.connected);
            socket.on('connect_error', function(err) {
                //console.log(socket);
                // console.log(err);
                console.log("error while connecting to port 8443");
                socket.disconnect();
                socket = io({'forceNew':true });

                socket.on('connect', function() {
                    console.log("connected via default port 443!");
                    // socket.emit('login');
                });

                socket.on('disconnect', function() {
                    console.log("disconnected!");
                    $(location).attr('href','/logout');
                });

                socket.on('login', login);
                socket.on('load contacts', loadContacts);
                socket.on('load blocked contacts', loadBlockedContacts);
                socket.on('load conversation', loadConversation);
                socket.on('text', getText);
                socket.on('image', getImage);
                socket.on('emoticon', getEmoticon);
                socket.on('event', getEvent);
                socket.on('location', getLocation);
                socket.on('add contact', addContact);
                socket.on('online status', updateOnlineStatus);
                socket.on('mood', getMood);
                socket.on('color', getColor);
                socket.on('importance', getImportance);
                socket.on('load older', loadOlderMessages);
                socket.on('got blocked', gotBlocked);
                socket.on('handle block', handleBlock);
            });
        }

        socket.on('connect', function() {
            console.log("connected!");
        });

        socket.on('disconnect', function() {
            console.log("disconnected!");
            $(location).attr('href','/logout');
        });


        socket.on('login', login);
        socket.on('load contacts', loadContacts);
        socket.on('load blocked contacts', loadBlockedContacts);
        socket.on('load conversation', loadConversation);
        socket.on('text', getText);
        socket.on('image', getImage);
        socket.on('emoticon', getEmoticon);
        socket.on('event', getEvent);
        socket.on('location', getLocation);
        socket.on('add contact', addContact);
        socket.on('online status', updateOnlineStatus);
        socket.on('mood', getMood);
        socket.on('color', getColor);
        socket.on('importance', getImportance);
        socket.on('load older', loadOlderMessages);
        socket.on('got blocked', gotBlocked);
        socket.on('shribing', getShribing);
        socket.on('handle block', handleBlock);

        $(window).focus(function() {
            windowActive = true;
            if(newMessageWhileInactive) {
                newMessageWhileInactive = false;
                app.newMessagesCounter--;
                ui.changeMessageCounter();
            }
        });

        $(window).blur(function() {
            windowActive = false;
        });
    };

    $(document).ready(init);

    return {
        openConversation: openConversation,
        requestOlderMessages: requestOlderMessages,
        sendText: sendText,
        sendImage: sendImage,
        sendEmoticon: sendEmoticon,
        sendEvent: sendEvent,
        sendLocation: sendLocation,
        sendAddress: sendAddress,
        requestNewContact: requestNewContact,
        changeColor: changeColor,
        sendShribing: sendShribing,
        blockContact: blockContact,
        newMessagesCounter: newMessagesCounter
    };
}(google,swal));