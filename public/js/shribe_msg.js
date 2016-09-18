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
var msg = (function ($, moment, _, google) {
    var convContainerDiv,
        convHeaderDiv,
        messagesUl,

        Content,
        mapID = 0,
        maps = [],

        EventContent,
        TextContent,
        Image,
        Emoticon,
        Location,

        contentByType,
        init;

    // ########## all contents ##########
    Content = function (value, timestamp, mine) {
        this.value = value;
        this.timestamp = timestamp;
        this.mine = mine;
    };
    Content.prototype.toServer = function () {
        return {
            idconversation: data.current(),
            value: this.value,
            time: this.timestamp.toJSON()
        };
    };
    Content.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        contentLi.append($('<p>').text('unknown content type'));
        console.log('displayed content without type');
        if (scrollDown) {
            convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        }
    };

    // ########## Text ##########
    TextContent = function (value, timestamp, mine) {
        Content.call(this, value, timestamp, mine);
    };
    TextContent.prototype.__proto__ = Content.prototype;
    TextContent.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        var textP = $('<p>').addClass('textContent');
        if (this.value.length < 10) { textP.addClass('short'); }


        textP.html( _.escape(this.value)                                                                    // escape the text from html
                    .replace(/\n/g, "<br>")                                                                 //  and make line breaks visible via <br> visible
                    .replace(/(http(s)?:\/\/?\S+)/g, "<a href='$1' target='_blank'>$1</a>")                 // display links as <a href..> which open in new window

                    /**
                    .replace(/(?:https:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^\ ]+)/g, // display  youtube links
                        '<iframe width="300" height="200" src="https://www.youtube.com/embed/$1" frameborder="0" allowfullscreen></iframe>')
                    .replace(/(?:http:\/\/)?(?:www\.)?(?:vimeo\.com)\/(.+)/g,                               // display vimeo links
                        '<iframe src="//player.vimeo.com/video/$1" width="300" height="200" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>')
                    NOT WORKING TOGETHER WITH LINK REPLACEMENT */
                    );
        contentLi.append(textP);
        contentLi.addClass('text');

        var messageLi = contentLi.parent().parent();

        if (!messageLi.hasClass('text')) {
            var prevText = this.value.substring(0, 35);
            if (this.value.length > 35) { prevText += '...'; }
            messageLi.children('.preview').prepend($('<p>').text(prevText));
            messageLi.addClass('text');
        } else if (!messageLi.hasClass('moreText')) {
            messageLi.find('.preview > p').after($('<p>').text('...'));
            messageLi.addClass('moreText');
        }
        if (scrollDown) {
            convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        }
       // console.log('displayed content of type text');
    };

    // ########## Image ##########
    Image = function (value, timestamp, mine) {
        Content.call(this, value, timestamp, mine);
    };
    Image.prototype.__proto__ = Content.prototype;
    Image.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        var  reader = new FileReader(); // init file reader for reading images
        var image = $('<img>');
        // START BLOB method
        reader.onload = function(e) {
            image.attr( "src", e.target.result);
            image.load(function () {
                contentLi.append(image);
                //console.log('displayed content of type image');
                if (scrollDown) {
                    convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
                    console.log('scrolling down');
                }
            });
            /*
            var messageLi = contentLi.parent().parent();
            if (!messageLi.hasClass('image')) {
                messageLi.children('.preview').css('background-image', 'url(' + e.target.result + ')');
                messageLi.addClass('image');
            }
            */
        };
        reader.readAsDataURL(new Blob([this.value], {type : 'image/jpeg'}));
        contentLi.addClass('image');
        contentLi.parent().parent().addClass('image');
    };

    // ########## Emoticon ##########
    Emoticon = function (value, timestamp, mine) {
        Content.call(this, value, timestamp, mine);
    };
    Emoticon.prototype.__proto__ = Content.prototype;
    Emoticon.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        var image = $('<img>').attr('src', '../files/emoticons/' + this.value + '.png');
        contentLi.append(image);
        contentLi.addClass('emoticon');

        var messageLi = contentLi.parent().parent();

        if (!messageLi.hasClass('emoticon')) {
            messageLi.children('.preview').append(image.clone().addClass('emoPreview'));
            messageLi.addClass('emoticon');
        }
        image.load(function () {
            if (scrollDown) {
                convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
            }
        });

        //console.log('displayed content of type emoticon');
    };

    // ########## Event ##########
    EventContent = function (value, timestamp, mine) {
        Content.call(this, value, timestamp, mine);
    };
    EventContent.prototype.__proto__ = Content.prototype;
    EventContent.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        var event = JSON.parse(this.value);
        var eventContent = $('<div>');
        var dateObject = moment(event.date).format('DD.MM.YYYY, H:mm');
        var date = $('<p>').addClass('date').text(dateObject);
        var text = $('<p>').addClass('datedescription').text( event.text );

        eventContent.append(date);
        eventContent.append(text);

        contentLi.append(eventContent);
        contentLi.addClass('event');

        var messageLi = contentLi.parent().parent();
        if (!messageLi.hasClass('event')) {
            var previewEvent = $('<div>').addClass('previewEvent');
            previewEvent.append($('<img>').attr({
                src: '../files/icons/date_icon.png',
                alt: dateObject
            }));
            previewEvent.append($('<p>').text(event.text.substr(0, 10)));
            messageLi.children('.preview').children('.imgIcon').before(previewEvent);
            messageLi.addClass('event');
        }
        if (scrollDown) {
            convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        }
       // console.log('displayed content of type event');
    };

    // ########## Location ##########
    Location = function (value, timestamp, mine) {
        Content.call(this, value, timestamp, mine);
    };
    Location.prototype.__proto__ = Content.prototype;
    Location.prototype.display = function (contentLi, scrollDown) {
        //var scrollDown = !(convContainerDiv.scrollTop() < messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        var coords = JSON.parse(this.value);
        var mapDiv = $('<div>').addClass('map_div').attr('id', mapID);
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
        //maps.push(map);
        maps[mapID++] = map;
        //console.log(maps);
        var marker = new google.maps.Marker({position: myLatLng});
        marker.setMap(map);

        contentLi.addClass('location');
        contentLi.parent().parent().addClass('location');
        if (scrollDown) {
            convContainerDiv.scrollTop(messagesUl.height() + convHeaderDiv.height() - convContainerDiv.height());
        }
       //    console.log('displayed content of type location');



    };

    // ---------------------------------------------------------------------
    contentByType = function (type, value, timestamp, mine) {
    // ---------------------------------------------------------------------
        switch (type) {
            case 'text': return new TextContent(value, timestamp, mine);
            case 'image': return new Image(value, timestamp, mine);
            case 'emoticon': return new Emoticon(value, timestamp, mine);
            case 'event': return new EventContent(value, timestamp, mine);
            case 'location': return new Location(value, timestamp, mine);
            default: return new Content(value, timestamp, mine);
        }
    };

    // ---------------------------------------------------------------------
    init = function () {
    // ---------------------------------------------------------------------
        convContainerDiv = $('#convContainer');
        convHeaderDiv = $('#convHeader');
        messagesUl = $('#messages');
    };

    $(document).ready(init);

    return {
        Text: TextContent,
        Image: Image,
        Emoticon: Emoticon,
        EventContent: EventContent,
        Location: Location,
        contentByType: contentByType,
        maps: maps
    };
}($, moment, _, google));