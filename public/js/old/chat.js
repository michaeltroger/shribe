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
var socket = io(),// for openshift webhoster: var socket = io.connect('https://mikenet-shribe.rhcloud.com:8443', {'forceNew':true }),
    contacts = [],      // array of contacts
    currentConv,        // idconversation which is currently opened
    myData,               // data of this account

// functions
    login,              // get my own data from server
    loadContacts,       // store contacts from server in array and display all
    prepareMessages,    // sort contents into an array
    loadConversation,   // check and handle loaded contents
    openConversation,   // request messages and prepare conversation
    loadOlderMessages,
    requestOlderMessages,
    sendText,           // add the new message to current conversation and send it to server
    sendImage,          // send an image from file input to server and add it to current conversation
    sendEmoticon,       // send an emoticon to server
    sendLocation,       // send coordinates to server and add map to conversation
    getContent,         // update contact or add content to conversation
    requestNewContact,  // ask server for a new contact by email
    addContact,         // add new contact from server to array and display it
    updateOnlineStatus, // updates contact and redisplays conversation if necessary
    getMood,            // log mood to console
    changeColor,        // change color of contact and send it to server
    getColor,           // update contact with color from server
    getImportance,      // update importances of all contacts

// jquery variables
    contactsUl,         // list of contacts
    messageInput,       // input for text messages
    messagesUl,         // list of messages
    newMsgForm,         // form to send new elements in conversation
    newContactForm,     // form to add a new contact
    newContactInput,    // input for email of new contact
    imagefileInput,     // input for uploading images
    convNameP,          // represents name of open conversation (=user name)
    emoticonsToggleButton, // toggle to show the emoticonsSpan
    emoticonsSpan,      // the buttons to send emoticonsSpan
    geoLocationButton,  // button to send location
    colorpickerInput,   // input to choose conversation color
    convContainerDiv,   // div, which contains the conversation ul

// display functions
    displayContactList, // redisplay all contacts
    displayContact,     // display a contact in contacts list
    displayContactAttributes,   // update this contact's representation
    displayConversation,// display the conversation area with color and conversation data
    displayMessages,    // display only the given messages (whole conversation redisplayed)
    displayNewContent,  // mine(if I sent it), value(value of content), timestamp(Date object), displayFunc(function to display this type)
    displayTextMessage, // display text content
    displayImage,       // display image content
    displayEmoticon,    // display an emoticon
    displayLocation,    // display a map
    toggleEmoticons,    // show the div containing the emoticonsSpan
    toggleMessage,      // toggle the contents list of a message
    toggleColorpicker,  // toggle input to change conversation color
    init;               // initialize jquery objects and set event handlers


// ########## functions ##########


// ----------------------------------------------
login = function (load) {   // get my own data from server
// ----------------------------------------------
    myData = load;
    console.log('loggged in');
};

// ----------------------------------------------
loadContacts = function (loadedContacts) {  // store contacts from server in array and display all
// ----------------------------------------------
    loadedContacts.forEach(function (contact) {
        contacts[contact.idconversation] = contact;
    });
    console.log('loadContacts');
    displayContactList();
};

// ----------------------------------------------
prepareMessages = function (contents) { // sort contents into an array
// ----------------------------------------------
    var messages = [];
    contents.forEach(function (content) {
        var timestamp = new Date(content.time);
        var newContent = {
            type: content.type,
            value: content.value,
            time: timestamp.toLocaleTimeString()
        };

        if (!messages[content.idmessage]) {
            messages[content.idmessage] = {
                iduser: content.iduser,
                date: timestamp.toLocaleDateString(),
                contents: [newContent]
            };
        } else {
            messages[content.idmessage].contents.push(newContent);
        }
    });
    return messages;
};

// ----------------------------------------------
loadConversation = function (loaded) {  // check and handle loaded contents
// ----------------------------------------------
    console.log('loadConversation');
    if (loaded.idconversation == currentConv && loaded.messages && loaded.messages.length) {
        displayMessages(true, prepareMessages(loaded.messages));
        contacts[loaded.idconversation].gotNewMessage = false;
        displayContactAttributes(contacts[loaded.idconversation]);
    } else {
        displayMessages();
    }
};

// ----------------------------------------------
openConversation = function () {    // request messages and prepare conversation
// ----------------------------------------------
    console.log('openConversation - loading contents from server...');
    currentConv = $(this).attr('id');
    socket.emit('load conversation', currentConv);
    displayConversation();
};

// ----------------------------------------------
loadOlderMessages = function (loaded) {
// ----------------------------------------------
    console.log('loadOlderMessages');
    if (loaded.idconversation == currentConv && loaded.messages && loaded.messages.length) {
        displayMessages(false, prepareMessages(loaded.messages));
    } else {
        console.log('... no older messages available');
    }
};

// ----------------------------------------------
requestOlderMessages = function () {
// ----------------------------------------------
    var olderThanId = messagesUl.children('li:first').attr('id').substring(3);
    console.log('requestOlderMessages - older than id ' + olderThanId);
    socket.emit('load older', currentConv, olderThanId);
};

// ----------------------------------------------
sendText = function () {     // add the new message to current conversation and send it to server
// ----------------------------------------------
    if (messageInput.val()) {
        var timestamp = new Date();

        socket.emit('text', {
            idconversation: currentConv,
            value: messageInput.val(),
            time: timestamp.toJSON()
        });
        console.log('sendText - message sent');

        displayNewContent(true, messageInput.val(), timestamp, displayTextMessage);
        messageInput.val('');
    } else {
        console.log('sendText - No message typed in!')
    }
    return false;
};

// ----------------------------------------------
sendImage = function (e) { // send an image from file input to server and add it to current conversation
// ----------------------------------------------
    var file = e.originalEvent.target.files[0],
        reader = new FileReader(), // init file reader for reading images
        timestamp = new Date();

    console.log('sendImage');
    //When the file has been read...
    reader.onload = function(evt){
        socket.emit('image', {
            idconversation: currentConv,
            value: evt.target.result,
            time: timestamp.toJSON()
        });
        displayNewContent(true, evt.target.result, timestamp, displayImage);
    };
   //reader.readAsDataURL(file); // read as base64
   reader.readAsArrayBuffer(file); // read as array buffer
};

// ----------------------------------------------
sendEmoticon = function (e) { // send an emoticon to server
// ----------------------------------------------
    console.log('sendEmoticon');
    toggleEmoticons();
    var timestamp = new Date();
    socket.emit('emoticon', {
        idconversation: currentConv,
        value: e.target.id,
        time: timestamp.toJSON()
    });
    displayNewContent(true, e.target.id, timestamp, displayEmoticon);
    return false;
};

// ----------------------------------------------
sendLocation = function() { // send coordinates to server and add map to conversation
// ----------------------------------------------
    navigator.geolocation.getCurrentPosition(
        // success handler
        function(p) {
            console.log('sendLocation');
            var timestamp = new Date();
            var latLng = {
                latitude: p.coords.latitude,
                longitude: p.coords.longitude
            };
            latLng = JSON.stringify(latLng);

            socket.emit('location', {
                idconversation: currentConv,
                value: latLng,
                time: timestamp.toJSON()
            });
            displayNewContent(true, latLng, timestamp, displayLocation);
        },
        // error handler
        function(e) {
            alert("geolocation error: "+ e.code)
        }
    );
};

// ----------------------------------------------
getContent = function (loaded, displayFunc) {   // update contact or add content to conversation
// ----------------------------------------------
    console.log('getMessage');
    if (loaded.idconversation == currentConv) {
        displayNewContent(false, loaded.value, new Date(loaded.time), displayFunc);
    } else {
        contacts[loaded.idconversation].gotNewMessage = true;
        displayContactAttributes(contacts[loaded.idconversation]);
    }
};

// ----------------------------------------------
requestNewContact = function () {   // ask server for a new contact by email
// ----------------------------------------------
    if(newContactInput.val()) {
        socket.emit('add contact', newContactInput.val());
        console.log('requestNewContact - email sent to server');
    }
    newContactInput.val('');
    return false;
};

// ----------------------------------------------
addContact = function (load) {    // add new contact from server to array and display it or get status
// ----------------------------------------------
    if (load.errorMessage) {
        alert(load.errorMessage);
    } else if (load.contact) {
        contacts[load.contact.idconversation] = load.contact;
        displayContact(load.contact);
        console.log('addContact - added '+ load.contact.idconversation);
    } else {
        console.log('addContact - error: ' + load);
    }
};

// ----------------------------------------------
updateOnlineStatus = function (status) {    // updates contact and conversation if necessary
// ----------------------------------------------
    console.log('updateOnlineStatus - user: ' + contacts[status.idconversation].name);
    contacts[status.idconversation].online = status.online;
    contacts[status.idconversation].lasttime_online = new Date();
    displayContactAttributes(contacts[status.idconversation]);
    if (status.idconversation == currentConv) { displayConversation(); }
};

// ----------------------------------------------
getMood = function (loaded) { // log mood to console
// ----------------------------------------------
    console.log("new mood of conversation "+loaded.idconversation +" is "+loaded.mood);
    contacts[loaded.idconversation].mood = loaded.mood;
    displayContactAttributes(contacts[loaded.idconversation]);
    if (loaded.idconversation == currentConv) { displayConversation(); }
};

// ----------------------------------------------
changeColor = function () { // change color of conversation and send it to server
// ----------------------------------------------
    console.log('changeColor');
    var newColor = '#' + colorpickerInput.val();
    socket.emit('color', {
        idconversation: currentConv,
        color: newColor
    });

    contacts[currentConv].color = newColor;
    displayContactAttributes(contacts[currentConv]);
    displayConversation();
};

// ----------------------------------------------
getColor = function (loaded) {  // update conversation with color from server
// ----------------------------------------------
    console.log('getColor - change color of conversation ' + loaded.idconversation);
    contacts[loaded.idconversation].color = loaded.color;
    displayContactAttributes(contacts[loaded.idconversation]);
    if (loaded.idconversation == currentConv) { displayConversation(); }
};

// ----------------------------------------------
getImportance = function (loaded) { // update importance of all contacts
// ----------------------------------------------
    loaded.forEach(function (imp) {
        contacts[imp.idconversation].importance = imp.importance;
        displayContactAttributes(contacts[imp.idconversation]);
    });
};


// ########## display functions ##########


// ----------------------------------------------
displayContactList = function () {  // redisplay all contacts
// ----------------------------------------------
    console.log('displayContactList');
    contactsUl.html('');
    contacts.forEach(function (contact) {
        displayContact(contact);
    });
};

// ----------------------------------------------
displayContact = function (contact) {   // display a contact in contacts list
// ----------------------------------------------
    var li = $('<li>');
    li.attr({
        id: contact.idconversation,
        title: contact.email
    });
    li.text(contact.name);
    contactsUl.append(li);
    console.log('displayContact - ' + contact.name);
    displayContactAttributes(contact);
};

// ----------------------------------------------
displayContactAttributes = function (contact) { // update this contact's representation
// ----------------------------------------------
    console.log('displayContactAttributes');
    var classes = (contact.online) ? 'online' : 'offline';
    var contactLi = contactsUl.children('#' + contact.idconversation);

    classes += ' importance' + contact.importance;
    classes += ' mood' + contact.mood;
    if (contact.gotNewMessage) { classes += ' gotNewMessage'; }
    contactLi.attr('class', classes);

    contactLi.css('background-color', contact.color);
};

// ----------------------------------------------
displayConversation = function () { // display the conversation area with color and conversation data
// ----------------------------------------------
    console.log('displayConversation - ' + currentConv);
    var onlineDate = new Date(contacts[currentConv].lasttime_online);
    var online = (contacts[currentConv].online) ? ' - online' : ' - zuletzt online ' + onlineDate.toLocaleDateString();
    convNameP.text(contacts[currentConv].name + online);
    messagesUl.children('.partner').css('background-color', contacts[currentConv].color);
    $('#convContainer').attr('class', 'mood' + contacts[currentConv].mood);
};

// ----------------------------------------------
displayMessages = function (newest, messages) {   // display only the given messages (whole conversation redisplayed)
// ----------------------------------------------
    console.log('displayMessages');
    if (newest) {
        messagesUl.html('');
        if (!messages) {
            messagesUl.append($('<li><ul><span>New conversation</span></ul></li>'));
            return;
        }
    } else {
        messages.reverse();
    }

    messages.forEach(function (message, idmessage) {
        var messageLi = $('<li>');
        messageLi.attr({
            id: 'msg' + idmessage,
            class: 'message'
        });
        if (message.iduser != myData.iduser) {
            messageLi.addClass('partner');
            messageLi.css('background-color', contacts[currentConv].color);
        }
        messageLi.append($('<p>').text(message.date));

        var contentsUl = $('<ul>');
        messageLi.append(contentsUl);
        if (newest) {
            messagesUl.append(messageLi);
        } else {
            messagesUl.prepend(messageLi);
        }

        message.contents.forEach(function (content) {
            var contentLi = $('<li>');
            contentLi.append($('<p>').text(content.time));
            contentsUl.append(contentLi);
            if (content.type == 'text') {
                displayTextMessage(contentLi, content.value);
            } else if (content.type == 'image') {
                displayImage(contentLi, content.value);
            } else if (content.type == 'location') {
                displayLocation(contentLi, content.value);
            } else if (content.type == 'emoticon') {
                displayEmoticon(contentLi, content.value);
            } else {
                contentLi.append($('<p>').text('unknown type'));
            }
        });
    });
    if (newest) {
        $('#convContainer').scrollTop(messagesUl.height());
    }
};

// ----------------------------------------------
displayNewContent = function (mine, value, timestamp, displayFunc) {    // mine(if I sent it), value(value of content), timestamp(Date object), displayFunc(function to display this type)
// ----------------------------------------------
    var contentLi = $('<li>');
    contentLi.append($('<p>').text(timestamp.toLocaleTimeString()));

    var lastMessage = messagesUl.children('li:last');
    if (lastMessage[0] && lastMessage.hasClass('partner') != mine) {
        lastMessage.children('ul').append(contentLi);
    } else {
        var messageLi = $('<li>').addClass('message');
        if (!mine) {
            messageLi.addClass('partner');
            messageLi.css('background-color', contacts[currentConv].color);
        }
        messageLi.append($('<p>').text(timestamp.toLocaleDateString()));
        messageLi.append($('<ul>').append(contentLi));
        messagesUl.append(messageLi);
    }
    displayFunc(contentLi, value);
    convContainerDiv.scrollTop(messagesUl.height());
};

// ----------------------------------------------
displayTextMessage = function (contentLi, value) {    // display text content
// ----------------------------------------------
    var textP = $('<p>').addClass('textContent');
    textP.text(value);
    contentLi.append(textP);
    contentLi.parent().parent().addClass('text');
};

// ----------------------------------------------
displayImage = function (contentLi, value) {    // display image content
// ----------------------------------------------
    var  reader = new FileReader(); // init file reader for reading images

    var image = $('<img>').attr({
        // src: value // base64
        width: 350
    });
    contentLi.append(image);

    // START BLOB method
    reader.onload = function(e) {
        image.attr( "src", e.target.result);
        convContainerDiv.scrollTop(50000); // TODO maybe there is a more beautiful solution
    };
    reader.readAsDataURL(new Blob([value], {type : 'image/jpeg'}));
    // END BLOB method

    contentLi.parent().parent().addClass('image');
};

// ----------------------------------------------
displayEmoticon = function (contentLi, value) {    // display an emoticon
// ----------------------------------------------
    var image = $('<img>').attr({
        src: '../files/emoticons/' + value + '.png',
        width: 160
    });
    contentLi.append(image);
    contentLi.parent().parent().addClass('emoticon');
};

// ----------------------------------------------
displayLocation = function(contentLi, value) {  // display a map
// ----------------------------------------------
    var coords = JSON.parse(value);
    var mapDiv = $('<div>').addClass('map_div');
    contentLi.append(mapDiv);

    var myLatLng = new google.maps.LatLng(
        coords.latitude,
        coords.longitude
    );
    var myOptions = {
        center: myLatLng,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        scrollwheel: false
    };
    var map = new google.maps.Map( mapDiv[0], myOptions);
    var marker = new google.maps.Marker({position: myLatLng});
    marker.setMap(map);

    contentLi.parent().parent().addClass('location');
};

// ----------------------------------------------
toggleEmoticons = function () {    // append one emoticon to the message list
// ----------------------------------------------
    $("#emoticons").toggle();
};

// ----------------------------------------------
toggleColorpicker = function () {    // append one emoticon to the message list
// ----------------------------------------------
    $("#colorpicker").toggle();
};

// ----------------------------------------------
toggleMessage = function () {   // toggle the contents list of a message
// ----------------------------------------------
    $(this).siblings('ul').toggle();
};

// ----------------------------------------------
init = function () {    // initialize jquery objects and set event handlers
// ----------------------------------------------
    contactsUl = $('#contacts');
    messageInput = $('#m');
    messagesUl = $('#messages');
    newMsgForm = $('#newMsg');
    newContactForm = $('#newContact');
    newContactInput = $('#addcontactfield');
    imagefileInput = $('#imagefile');
    convNameP = $('#convName');
    geoLocationButton = $('#geoLocation');
    emoticonsToggleButton = $('#emoticonstoggle');
    emoticonsSpan = $('#emoticons');
    colorpickerInput = $('#colorpicker');
    convContainerDiv = $('#convContainer');

// ########## action ##########

    newMsgForm.submit(sendText);
    newContactForm.submit(requestNewContact);
    contactsUl.on('click', 'li', openConversation);
    imagefileInput.on('change', sendImage);
    geoLocationButton.on('click', sendLocation);
    emoticonsSpan.on('click', '.emoticon', sendEmoticon);
    emoticonsToggleButton.click(toggleEmoticons);
    convNameP.click(toggleColorpicker);
    colorpickerInput.blur(changeColor);
    messagesUl.on('click', '.message > p', toggleMessage);
    convContainerDiv.scroll(function () { if (!convContainerDiv.scrollTop()) { requestOlderMessages(); } });

// ########## reaction ##########

    socket.on('login', login);
    socket.on('load contacts', loadContacts);
    socket.on('load conversation', loadConversation);
    socket.on('text', function (loaded) { getContent(loaded, displayTextMessage); });
    socket.on('image', function (loaded) { getContent(loaded, displayImage); });
    socket.on('emoticon', function (loaded) { getContent(loaded, displayEmoticon); });
    socket.on('location', function (loaded) { getContent(loaded, displayLocation); });
    socket.on('add contact', addContact);
    socket.on('online status', updateOnlineStatus);
    socket.on('mood', getMood);
    socket.on('color', getColor);
    socket.on('importance', getImportance);
    socket.on('load older', loadOlderMessages);
};


init();