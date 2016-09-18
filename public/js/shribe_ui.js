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
var ui = (function ($,swal, google) {
    // jquery variables
    var contactsUl,         // list of contacts
        messagesUl,         // list of messages
        convNameP,          // represents name of open conversation (=user name)
        convContainerDiv,   // div, which contains the conversation ul
        convHeaderDiv,      // div containing additional info on the conversation or a link to load older contents
        newMsgContainerDiv,
        newMsgButtonsDiv,
        sendTextDiv,
        mTextarea,
        textBtn,
        addressInput,
        eventdescriptionInput,
        datetimepickerInput,
        blockBtn,
        blockedContactsDropdown,
        contactsBtn,
        newMsgCounterP,
        userOptionsDiv,
        convOptionsDiv,

    // test output strings
        ONLINE = 'on',
        OFFLINE = 'off for',
        LOADCONV = 'Loading conversation...',
        LOADING = 'loading...',
        LOADOLDER = 'Load older messages',
        NOOLDER = 'Beginning of this conversation',
        DEFAULT_TITLE = 'Shribe',
        SHRIBING = 'shribing...',

    // display functions
        dUserInfo,          // display or update the userInfo bar
        dContactList,
        dBlockedContactList,
        dContact,
        dContactAttributes,
        dConversation,
        setConversationReady,   // called when all messages are loaded
        clearMessages,
        setConvHeader,      // argument true for link, false if no older available
        dMessage,
        dNewContent,
        toggleMessage,
        filterMessages,     // use the desired filters on the messages
        resetFilter,        // show all messages unfiltered
        toggleNewMsg,
        changeMessageCounter,
        googleMapsBug,
        dShribing,
        init;

    // ----------------------------------------------
    dUserInfo = function () {
    // ----------------------------------------------
        var name = '' + data.name();
        $('#userInfo em').text(name);
        $('#userInfo em').attr('id', 'userName');
        $('#userInfo em').attr('title', 'Show blocked users');
    };

    // ----------------------------------------------
    dContactList = function () {  // redisplay all contacts
    // ----------------------------------------------
        contactsUl.html('');
        /*var compareFunc = function (a, b) {
            return b.importance - a.importance;
        };*/
        data.eachContact(dContact/*, compareFunc*/);
        $('#newContact').show();
        app.newMessagesCounter = $('.unseen').length;
        if(app.newMessagesCounter > 0) {
            changeMessageCounter();
        }
    };

    // ----------------------------------------------
    dBlockedContactList = function (loadedBlockedContacts) {  // redisplay all contacts
    // ----------------------------------------------
        if(loadedBlockedContacts.length != 0) {
            for(var i = 0; i < loadedBlockedContacts.length; i++) {
                var li = $('<li>');
                var button = $('<button>').html(loadedBlockedContacts[i].name);
                button.attr('id', loadedBlockedContacts[i].idconversation);
                button.addClass('btn btn-default unblockBtn');
                button.attr('title', loadedBlockedContacts[i].email);
                blockedContactsDropdown.append(li);
                li.append(button);
            }
        } else {
            $('#toggleBlockedContacts').hide();
        }
    };

    // ----------------------------------------------
    dContact = function (contact) {   // display a contact in contacts list
    // ----------------------------------------------
        var li = $('<li>').attr('id', contact.idconversation),
            p = $('<p>').text(contact.name),
            button = $('<button>').attr('title', contact.email);
        p.attr('title', contact.email);
        contactsUl.append(li);
        li.append(p);
        p.append(' <span class="online">' + ONLINE + '</span>');
        button.insertAfter(p);
        dContactAttributes(contact);
    };

    // ----------------------------------------------
    dContactAttributes = function (contact) { // update this contact's representation
    // ----------------------------------------------
        var classes = 'importance' + contact.importance,
            contactLi = contactsUl.children('#' + contact.idconversation),
            onlineEm = contactLi.find('.online');

        classes += ' c' + contact.color;
        if (!contact.seen) { classes += ' unseen'; }
        if (contact.gotNewMessage) { classes += ' gotNewMessage'; }
        if (data.isCurrent(contact.idconversation)) {
            contactsUl.children('.open').removeClass('open');
            classes += ' open';
        }
        if (contact.online) { onlineEm.show(); } else { onlineEm.hide() }
        if (contact.online || !contact.seen || contact.gotNewMessage) { contactsUl.prepend(contactLi); }
        contactLi.attr('class', classes);
    };

    // ----------------------------------------------
    dConversation = function () { // display the conversation area with color and conversation data
    // ----------------------------------------------
        console.log('displayConversation');
        var contact = data.currentContact();
        var online = (contact.online)   ? ' <span class="online">' + ONLINE + '</span>'
                                        : ' ' + OFFLINE + ' ' + moment(contact.lasttime_online).locale('en').from(moment(), true);
        //convNameP.html('<em title="' + contact.email + '">' + contact.name + '</em>' + online);
        convNameP.html('<em>' + contact.name + '</em>' + online);
        convNameP.append($('<span>').attr('id', 'shribing').text(' ' + SHRIBING).hide());
        $('body').attr('class', 'mood' + contact.mood);
        $('#conversation').attr('class', 'col-md-6 c' + contact.color);
        $('#convInfo').show();
    };

    // ----------------------------------------------
    setConversationReady = function (idconversation, scrollTo) {
    // ----------------------------------------------
        if (data.isCurrent(idconversation)) {
            console.log('conversation ' + idconversation + ' ready');
            contactsUl.children().removeClass('loading');
            convHeaderDiv.removeClass('loading');
            toggleNewMsg(false);
            dContactAttributes(data.contact(idconversation));
            if (scrollTo) { // scroll to last loaded message
                console.log('jump to msg' + scrollTo);
                convContainerDiv.scrollTop($('#msg' + scrollTo).position().top);
            } else { // if newly opened, scroll down
                convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
            }
        }
    };

    // ----------------------------------------------
    clearMessages = function () {
    // ----------------------------------------------
        convHeaderDiv.empty().append($('<p>').text(LOADCONV));
        messagesUl.html('');
        resetFilter();
    };

    // ----------------------------------------------
    setConvHeader = function (available) {
    // ----------------------------------------------
        if (available) {
            if (convHeaderDiv.children('p')[0]) {   // create link only if it is not yet created
                var loadOlderA = $('<a>').attr('href', '#').text(LOADOLDER);
                loadOlderA.click(function () {
                    if(!convHeaderDiv.hasClass('loading')) {
                        var msgId = messagesUl.children('li:first').attr('id');
                        if (msgId != 'convStart') {
                            app.requestOlderMessages(msgId.substring(3));
                            convHeaderDiv.addClass('loading');
                            convHeaderDiv.empty().append($('<p>').text(LOADING));
                        }
                    }
                    return false;
                });
                convHeaderDiv.empty().append(loadOlderA);
            }
        } else {
            convHeaderDiv.empty().append($('<p>').text(NOOLDER));
        }
    };

    // ----------------------------------------------
    dMessage = function (last, contents, idmessage) {   // display only the given messages (whole conversation redisplayed)
    // ----------------------------------------------
        console.log('display message ' + idmessage);
        var messageLi = $('<li>').addClass('message');
        if (!contents[0].mine) {
            messageLi.addClass('partner');
        }
        if (idmessage) {
            messageLi.attr('id', 'msg' + idmessage);
        }
        var dateMessage = moment(contents[0].timestamp);
        var dateToday = moment();
        if(dateToday.startOf('day').isSame(dateMessage.startOf('day'))) {
            dateMessage = "today, " + moment(contents[0].timestamp).format('HH:mm');
        } else {
            if(dateMessage.format('YYYY') == dateToday.format('YYYY')) {
                dateMessage = moment(contents[0].timestamp).format('DD.MM. HH:mm');
            } else {
                dateMessage = moment(contents[0].timestamp).format('DD.MM.YYYY, HH:mm');
            }
        }
        messageLi.append($('<p>')
                .addClass('msgHeader')
                .text(dateMessage)
                .attr('title', moment(contents[0].timestamp).format('DD.MM.YYYY, HH:mm'))
        );

        var preview = $('<div>').attr({
            class: 'preview',
            title: 'Click to open this message!'
        });
        messageLi.append(preview);
        preview.append($('<img>').attr({src: '../files/icons/image_icon.png', class: 'imgIcon'}));
        preview.append($('<img>').attr({src: '../files/icons/location_icon.png', class: 'locIcon'}));
        preview.toggle(false);

        var contentsUl = $('<ul>');
        messageLi.append(contentsUl);
        if (last) {
            messagesUl.append(messageLi);
            toggleMessage.call(messageLi.prev().prev().prev(), false);
        } else {
            messagesUl.prepend(messageLi);
            toggleMessage.call(messageLi, false);
        }
        var scrollDown = last
            && (convContainerDiv.scrollTop() > messagesUl.height() +convHeaderDiv.height() - 2 * convContainerDiv.height()
            || convContainerDiv.scrollTop() == 0);
        contents.forEach(function (content) {
            var contentLi = $('<li>');
            contentsUl.append(contentLi);
            contentLi.append($('<p>').addClass('contentHeader').text(moment(content.timestamp).format('HH:mm')));
            content.display(contentLi, scrollDown);   // scroll down if message is appended
        });
    };

    // ----------------------------------------------
    dNewContent = function (content) {    // mine(if I sent it), value(value of content), timestamp(Date object), displayFunc(function to display this type)
    // ----------------------------------------------
        var lastMessage = messagesUl.children('li:last');
        if (lastMessage[0] && lastMessage.hasClass('partner') != content.mine) {
            toggleMessage.call(lastMessage, true);
            var contentLi = $('<li>');
            lastMessage.children('ul').append(contentLi);
            contentLi.append($('<p>').addClass('contentHeader').text(moment(content.timestamp).format('HH:mm')));
            var scrollDown = convContainerDiv.scrollTop() > messagesUl.height() +convHeaderDiv.height() - 2 * convContainerDiv.height()
                || convContainerDiv.scrollTop() == 0;
            content.display(contentLi, scrollDown);
            messagesUl.children('li:last').addBack('li').show();
        } else {
            dMessage(true, [content]);
        }
    };

    // ----------------------------------------------
    toggleMessage = function (open) {   // open can be an event object which we want to ignore!
    // ----------------------------------------------
        console.log('toggleMessage id: ' + $(this).attr('id') + ' open=' + open);
        if (open === true) {
            $(this).children('ul').show();
            $(this).children('.preview').hide();
        } else if (open === false) {
            $(this).children('ul').hide();
            $(this).children('.preview').css('display', '');
        } else {
            var messageLi = $(this).parent(),
                contentsUl = messageLi.children('ul');
            if (contentsUl.is(':visible')) {
                contentsUl.hide();
                messageLi.children('.preview').css('display', '');
            } else {
                contentsUl.show();
                messageLi.children('.preview').hide();
                console.log('toggled message' + messageLi.attr('id') + ' position: ' + messageLi.position().top);
                convContainerDiv.scrollTop(convContainerDiv.scrollTop() + messageLi.position().top);
            }
        }
    };
    // ----------------------------------------------
    googleMapsBug = function () {
    // ----------------------------------------------
        /** GOOGLE MAPS BUG IN HIDDEN DIV WORKAROUND  */
        //console.log("filtered location");
        //console.log($(this).parent());

        var mapsInThisMessage = $('#messages').find(".map_div"); // find all maps in this message
        //console.log(mapsInThisMessage);
        for (var i = 0; i < mapsInThisMessage.length; i++) {    // go over all messages and "resize" them for getting displayed properly
            //console.log(mapsInThisMessage[i].id);
            var map = msg.maps[mapsInThisMessage[i].id];
            //console.log(map);
            // the bugfix itself:
            var center = map.getCenter();
            google.maps.event.trigger(map, "resize");
            map.setCenter(center);
        }
        /** END GOOGLE MAPS **/
    };

    // ----------------------------------------------
    filterMessages = function (type) {  // use the desired filters on the messages
        // ----------------------------------------------
        var classes = [],
            allMessages,
            filteredMessage;
        $('.btn-filter.active').each(function(i, obj) { // iterate through all active filter buttons
            classes[i] = obj;
        });

        switch(type) {
            case 'click':
                allMessages = $('#messages .message').find('li').addBack('li');
                break;
            case 'load':
                allMessages = $('#messages .message:lt(5)').find('li').addBack('li');
                break;
        }

        if(classes.length === 0 || (classes.length === 1 && classes[0].id === 'showAll')) { // if classes is empty or only contains showAll
            resetFilter();
        } else {    // if some other filter button is active
            $('#showAll').removeClass('active');    // make showAll inactive
            allMessages.hide();   // hide all messages first to only show the desired ones later

            for(var i = 0; i < classes.length; i++) {
                filteredMessage = allMessages.filter(function() {
                    return $(this).hasClass($(classes[i]).attr('id'));  // only show the messages that share the same class with the filter button's id
                });

                filteredMessage.show();
                toggleMessage.call(filteredMessage, true);
            }
        }
        console.log('messages filtered');
        googleMapsBug(); // resize all maps so that they are visible
    };

    // ----------------------------------------------
    resetFilter = function () { // show all messages unfiltered
    // ----------------------------------------------
        $('.btn-filter.active').each(function(i, obj) { // iterate through all active filter buttons and make them inactive
            $(obj).removeClass('active');
        });
        $('#showAll').addClass('active');
        $('#messages li').show();
        toggleMessage.call($('#messages .message:lt(-3)').find('li').addBack('li'), false);
        console.log('filter resetted');
    };

    // ----------------------------------------------
    toggleNewMsg = function (e) {
    // ----------------------------------------------
        if (e) {
            newMsgButtonsDiv.hide();
            switch ($(this).attr('id')) {
                case 'newText': sendTextDiv.show();
                    mTextarea.focus();
                    break;
                case 'newEmoticon': $('#sendEmoticon').show(); break;
                case 'newLocation': $('#sendLocation').show();
                    addressInput.focus();
                    break;
                case 'newEvent': $('#sendEvent').show();
                    $('#datetimepicker').focus();
                    break;
            }
        } else {
            console.log('toggleNewMsg false');
            newMsgContainerDiv.children().hide();
            newMsgButtonsDiv.show();
            newMsgButtonsDiv.children('input')[0].focus();
        }
    };

    // ----------------------------------------------
    changeMessageCounter = function () {
    // ----------------------------------------------
        if(app.newMessagesCounter <= 0) {
            app.newMessagesCounter = 0;
            document.title = DEFAULT_TITLE;
            contactsBtn.attr('title', 'Show contacts');
            contactsBtn.removeClass('newMsg');
        } else {
            document.title = "(" + app.newMessagesCounter + ") " + DEFAULT_TITLE;
            contactsBtn.attr('title', 'New messages! Show contacts');
            newMsgCounterP.html(app.newMessagesCounter);
            contactsBtn.addClass('newMsg');
        }
    };

    // ----------------------------------------------
    dShribing = function (now) {
    // ----------------------------------------------
        var shribingSpan = convNameP.find('#shribing');
        if (now) {
            shribingSpan.show();
        } else {
            shribingSpan.hide();
        }
    };

    // ----------------------------------------------
    init = function () {    // initialize jquery objects and set event handlers
    // ----------------------------------------------
        contactsUl = $('#contacts');
        messagesUl = $('#messages');
        convNameP = $('#convName');
        convContainerDiv = $('#convContainer');
        convHeaderDiv = $('#convHeader');
        newMsgContainerDiv = $('#newMsgContainer');
        newMsgButtonsDiv = $('#newMsgButtons');
        sendTextDiv = $('#sendText');
        mTextarea = $('#m');
        textBtn = $('#textBtn');
        addressInput = $('#address');
        eventdescriptionInput = $("#eventdescription");
        datetimepickerInput = $('#datetimepicker');
        blockBtn = $('#blockBtn');
        blockedContactsDropdown = $('#toggleBlockedContacts + ul');
        contactsBtn = $('#contacts-btn');
        newMsgCounterP = $('.newMsgCounter');
        userOptionsDiv = $('#userOptions');
        convOptionsDiv = $('#convOptions');

        $("body").on("click", ".btn-filter", function(e) {
            e.stopPropagation();
            $(this).toggleClass('active');

            if(this.id === 'showAll') {
                resetFilter();
            } else {
                filterMessages('click');
            }
        });
        messagesUl.on('click', '.msgHeader, .preview', toggleMessage);

        // GOOGLE MAPS BUG IN HIDDEN DIV WORKAROUND
        messagesUl.on('click', '.location .msgHeader, .location .preview', function() { // if a message is opened with a map inside
            googleMapsBug();
        });


        contactsUl.on('click', 'button, p', function () {
            var contactLi = $(this).parent();
            if(!contactLi.hasClass('loading')) {
                if(contactLi.hasClass('unseen')) {
                    app.newMessagesCounter--;
                    changeMessageCounter();
                }
                app.openConversation(contactLi.attr('id'));
                contactsUl.children('.open').removeClass('open');
                contactLi.addClass('open');
                contactLi.addClass('loading');
                convOptionsDiv.hide();
                newMsgContainerDiv.children().hide();
            }
        });
        convContainerDiv.scroll(function () {
            if (!convContainerDiv.scrollTop() && messagesUl.has('li').length && convHeaderDiv.has('a').length) {
                var msgId = messagesUl.children('li:first').attr('id');
                if (msgId != 'convStart' && !convHeaderDiv.hasClass('loading')) {
                    app.requestOlderMessages(msgId.substring(3));
                    convHeaderDiv.addClass('loading');
                    convHeaderDiv.empty().append($('<p>').text(LOADING));
                }
            }
        });
        // sending text ---------------------------------------------
        textBtn.click(function () {
            app.sendText(mTextarea.val());
            mTextarea.val('');
            toggleNewMsg(false);
            return false;
        });
        mTextarea.keydown(function (e) {
            console.log('key pressed');
            if (e.keyCode == 13 && !e.shiftKey) {
                e.preventDefault();
                app.sendText(mTextarea.val());

                e.preventDefault();
                mTextarea.val('');
                toggleNewMsg(false);
            } else if (e.keyCode == 27) {
                e.preventDefault();
                mTextarea.val('');
                toggleNewMsg(false);
            } else {
                app.sendShribing();
            }

        });
        $('#keyInput').keypress(function (e) {
            e.preventDefault();
            newMsgButtonsDiv.hide();
            sendTextDiv.show();
            mTextarea.focus();
            mTextarea.val(String.fromCharCode(e.charCode));
        });
        // sending an image -----------------------------------------
        $('#imagefile').on('change', function (e) {
            app.sendImage(e.originalEvent.target.files[0]);
        });
        // sending an emoticon --------------------------------------
        $('#emoticons').on('click', '.emoticon', function (e) {
            app.sendEmoticon(e.target.id);
            toggleNewMsg(false);
            return false;
        });
        // sending a location ---------------------------------------
        $("#addressBtn").click(function(e) {
            app.sendAddress(addressInput.val());
            addressInput.val('');
            toggleNewMsg(false);
        });
        addressInput.keydown(function (e) {
            console.log('key pressed');
            switch (e.keyCode) {
                case 13:
                    e.preventDefault();
                    app.sendAddress(addressInput.val());
                case 27:
                    e.preventDefault();
                    addressInput.val('');
                    toggleNewMsg(false);
            }
        });
        $('#locationBtn').click(function () {
            app.sendLocation();
            toggleNewMsg(false);
        });
        // sending an event -----------------------------------------
        datetimepickerInput.datetimepicker({ // enable datetimepicker  plugin
            locale: 'de' // time/date format: english locale
        });
        $('#eventBtn').click(function(e){
            var eventdescriptionInput = $("#eventdescription");
            app.sendEvent(datetimepickerInput.data("DateTimePicker").date(), eventdescriptionInput.val());
            datetimepickerInput.val('');
            eventdescriptionInput.val('');
            toggleNewMsg(false);
        });
        var eventKeyHandler = function (e) {
            console.log('key pressed');
            switch (e.keyCode) {
                case 13:
                    e.preventDefault();
                    app.sendEvent(datetimepickerInput.data("DateTimePicker").date(), eventdescriptionInput.val());
                case 27:
                    e.preventDefault();
                    datetimepickerInput.val('');
                    eventdescriptionInput.val('');
                    toggleNewMsg(false);
            }
        };
        datetimepickerInput.keydown(eventKeyHandler);
        eventdescriptionInput.keydown(eventKeyHandler);


        var newContactHandler = function () {
            var newContactInput = $('#addcontactfield');
            var testEmail = /^[A-Z0-9._%+-]+@([A-Z0-9-]+\.)+[A-Z]{2,4}$/i;
            if(newContactInput.val() == "") {
                swal("Please enter an email!");
            } else if (newContactInput.val().length > 100) {
                swal("The entered email is too long!");
            } else if (!testEmail.test(newContactInput.val())) {
                swal("The entered email is not valid!");
            } else {
                console.log('new contact handler');
                app.requestNewContact(newContactInput.val());
                newContactInput.val('');
            }
            return false;
        };
        $('#newContact').submit(newContactHandler);
        $('#addcontactbutton').click(newContactHandler);

        newMsgButtonsDiv.on('click', 'span.cButton', toggleNewMsg);
        $('.back').click(function () {toggleNewMsg(false);});

        convOptionsDiv.on('click', '#blockBtn', function() {
            swal({
                title: "Are you sure?",
                text: "You will no longer be able to receive messages from this contact!\n\n" +
                "You can undo this at every time by removing the contact from blocked contacts by clicking on your name.",
                type: "warning",
                showCancelButton: true,
                //confirmButtonColor: "#DD6B55",
                confirmButtonText: "Yes, block contact!",
                cancelButtonText: "No, cancel please!"
                //closeOnConfirm: false
                //closeOnCancel: false
            },
            function(isConfirm){
                if (isConfirm) {
                    //swal("Contact blocked!", "You can undo this at every time by removing the contact from the blocked contacts by clicking on your name.", "success");
                    app.blockContact(data.currentContact().idconversation, true);
                } else {
                    //swal("Cancelled", "User has not been blocked :)", "error");
                }
            });

        });

        blockedContactsDropdown.on('click', '.unblockBtn', function() {
            app.blockContact(this.id, false);
        });

        convNameP.on('click', function() {
            convOptionsDiv.show();
        });

        convOptionsDiv.on('click', '#closeConvOptions', function() {
            convOptionsDiv.hide();
        });

        $('#userInfo p').on('click', '#userName', function() {
            userOptionsDiv.show();
        });

        userOptionsDiv.on('click', '#closeUserOptions', function() {
            userOptionsDiv.hide();  //
        });

        $('#userInfo').on('click', '#contacts-btn', function() {
            $('#contactsContainer').toggleClass('showMobile');
            $('#newContact').toggleClass('showMobile');
            $('#users').toggleClass('open');
        });

        $('#colors').on('click', 'button', function (e) {
            app.changeColor(e.target.id.substring(1, 7));
        });

        mTextarea.change(app.sendShribing);
    };

    $(document).ready(init);

    return {
        userInfo: dUserInfo,
        contactList: dContactList,
        blockedContactList: dBlockedContactList,
        contact: dContact,
        contactAttributes: dContactAttributes,
        conversation: dConversation,
        setConversationReady: setConversationReady,
        clearMessages: clearMessages,
        setConvHeader: setConvHeader,
        message: dMessage,
        newContent: dNewContent,
        filterMessages: filterMessages,
        changeMessageCounter: changeMessageCounter,
        shribing: dShribing
    };
}($,swal, google));
