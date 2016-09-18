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
var socket = io(),
    contacts = [],      // array of contacts
    messages = [],      // every key (=idconversation) contains an array of messages
    currentConv,        // idconversation which is currently opened
    myData,               // data of this account

// functions
    login,              // get my own data from server
    loadContacts,       // store contacts from server in array and display all
    loadConversation,   // store old messages from server in array and redisplay the conversation
    openConversation,   // set the current conversation and display the conversation, load messages if necessary
    sendMessage,        // add the new message to current conversation and send it to server
    getMessage,         // add new message from server to conversation and update view
    sendImage,          // send an image from file input to server
    getImage,           // get an image from server and add it to messages array
    requestNewContact,  // ask server for a new contact by email
    addContact,         // add new contact from server to array and display it
    updateOnlineStatus,

// jquery variables
    contactsUl,         // list of contacts
    messageInput,       // input for text messages
    messagesUl,         // list of messages
    newMsgForm,         // form to send new elements in conversation
    newContactForm,     // form to add a new contact
    newContactInput,    // input for email of new contact
    imagefileInput,     // input for uploading images
    convNameP,          // represents name of open conversation (=user name)

// display functions
    displayContactList, // redisplay all contacts
    displayContact,     // display a contact in contacts list
    displayConversation,// display the conversation area with color and conversation data
    displayMessages,    // redisplay all messages of the current conversation
    displayTextMessage, // append one text message to the message list
    displayImage,       // append one image to the message list
    init;               // initialize jquery objects and set event handlers


// ########## functions ##########


// ----------------------------------------------
login = function (load) {
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
loadConversation = function (loaded) {  // store old messages from server in array and redisplay the conversation
// ----------------------------------------------
    if(loaded.messages) {
        messages[loaded.idconversation] = loaded.messages;
        console.log('loadConversation - messages from server available');
    } else {
        messages[loaded.idconversation] = [];
        console.log('loadConversation - empty');
    }

    displayMessages();
};

// ----------------------------------------------
openConversation = function () {    // set the current conversation and display the conversation, load messages if necessary
// ----------------------------------------------
    currentConv = $(this).attr('id');
    if (messages[currentConv]) {
        displayMessages();
        console.log('openConversation - already loaded');
    } else {
        socket.emit('load conversation', currentConv);   // request messages for this conversation from server
        console.log('openConversation - load...');
    }

    displayConversation();
};

// ----------------------------------------------
sendMessage = function (e) {     // add the new message to current conversation and send it to server
// ----------------------------------------------
    if (messageInput.val()) {
        socket.emit('chat message', {
            idconversation: currentConv,
            value: messageInput.val()
        });
        console.log('sendText - message sent');

        var newMessage = {
            iduser: myData.iduser,
            type: 'text',
            value: messageInput.val()
        };
        messages[currentConv].push(newMessage);
        messageInput.val('');
        displayTextMessage(newMessage);
    } else {
        console.log('sendText - No message typed in!')
    }
    return false;
};

// ----------------------------------------------
getMessage = function (loaded) {    // add new message from server to conversation and update view
// ----------------------------------------------
    var newMessage = {
        iduser: contacts[loaded.idconversation].iduser,
        type: 'text',
        value: loaded.value
    };
    console.log('getText - message added');

    messages[loaded.idconversation].push(newMessage);
    if (loaded.idconversation == currentConv) {
        displayTextMessage(newMessage);
    }
};

// ----------------------------------------------
sendImage = function (e) { // send an image from file input to server
// ----------------------------------------------
    //Get the first (and only one) file element
    //that is included in the original event
    var file = e.originalEvent.target.files[0],
        reader = new FileReader();

    console.log('sendImage');
    //When the file has been read...
    reader.onload = function(evt){
        //Because of how the file was read,
        //evt.target.result contains the image in base64 format
        //Nothing special, just creates an img element
        //and appends it to the DOM so my UI shows
        //that I posted an image.
        //send the image via Socket.io
        //console.log();
        socket.emit('image', {
            idconversation: currentConv,
            value: evt.target.result
        });

        var newMessage = {
            iduser: myData.iduser,
            type: 'image',
            value: evt.target.result
        };
        messages[currentConv].push(newMessage);
        displayImage(newMessage);
    };
    //And now, read the image and base64
    console.log(file);
    reader.readAsDataURL(file);
};

// ----------------------------------------------
getImage = function (loaded) { // get an image from server and add it to messages array
// ----------------------------------------------
    var newMessage = {
        iduser: contacts[loaded.idconversation].iduser,
        type: 'image',
        value: loaded.value
    };
    console.log('getImage - message added');

    messages[loaded.idconversation].push(newMessage);
    if (loaded.idconversation == currentConv) {
        displayImage(newMessage);
    }
};

// ----------------------------------------------
requestNewContact = function (e) {   // ask server for a new contact by email
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
        contacts.push(load.contact);
        displayContact(load.contact);
        console.log('addContact - added '+ load.contact.name);
    } else {
        console.log('addContact - error: ' + load);
    }
};

// ----------------------------------------------
updateOnlineStatus = function (status) {
// ----------------------------------------------
    contacts[status.idconversation].online = status.online;
    contacts[status.idconversation].lasttime_online = Date.now();
    displayContactList();
    console.log('updateOnlineStatus - user: ' + contacts[status.idconversation].name);
};


// ########## display functions ##########


// ----------------------------------------------
displayContactList = function () {  // redisplay all contacts
// ----------------------------------------------
    contactsUl.html('');
    contacts.forEach(function (contact) {
        displayContact(contact);
    });
    console.log('displayContactList');
};

// ----------------------------------------------
displayContact = function (contact) {   // display a contact in contacts list
// ----------------------------------------------
    var li = $('<li>');
    var online = (contact.online) ? ' - online' : ' - offline';
    li.attr('id', contact.idconversation);
    li.text(contact.name + online);
    contactsUl.append(li);
    console.log('displayContact - ' + contact.name);
};

// ----------------------------------------------
displayConversation = function () { // display the conversation area with color and conversation data
// ----------------------------------------------
    var onlineDate = new Date(contacts[currentConv].lasttime_online);
    var online = (contacts[currentConv].onlone) ? ' - online' : ' - zuletzt online ' + onlineDate.toLocaleDateString();
    convNameP.text(contacts[currentConv].name + online);
};

// ----------------------------------------------
displayMessages = function () {     // redisplay all messages of the current conversation
// ----------------------------------------------
    messagesUl.html('');
    messages[currentConv].forEach(function (message) {
        if (message.type == 'text') {
            displayTextMessage(message);
        } else if (message.type == 'image') {
            displayImage(message);
        } else {
            console.log('Unknown message type: ' + message.type);
        }
    });
};

// ----------------------------------------------
displayTextMessage = function (message) {    // append one text message to the message list
// ----------------------------------------------
    var li = $('<li>');
    if (message.iduser != myData.iduser) { li.addClass('partner'); }
    li.text(message.value);
    messagesUl.append(li);
    $('#convContainer').scrollTop(messagesUl.height());
};

// ----------------------------------------------
displayImage = function (message) {    // append one image to the message list
// ----------------------------------------------
    var li = $('<li>');
    if (message.iduser != myData.iduser) { li.addClass('partner'); }
    li.append($('<img>').attr({
        src: message.value,
        width: 350
    }));
    messagesUl.append(li);
    $('#convContainer').scrollTop(messagesUl.height());
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

// ########## action ##########

    newMsgForm.submit(sendMessage);
    newContactForm.submit(requestNewContact);
    contactsUl.on('click', 'li', openConversation);
    imagefileInput.on('change', sendImage);

// ########## reaction ##########

    socket.on('login', login);
    socket.on('load contacts', loadContacts);
    socket.on('load conversation', loadConversation);
    socket.on('chat message', getMessage);
    socket.on('add contact', addContact);
    socket.on('image', getImage);
    socket.on('online status', updateOnlineStatus);
};


init();