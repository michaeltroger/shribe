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
var data = (function () {
    var contacts = [],      // array of contacts
        currentConv,        // idconversation which is currently opened
        myIduser,           // iduser of this account
        myName,

        setMyData,
        setContact,
        setCurrent,
        contact,
        current,
        currentContact,
        eachContact,
        isCurrent,
        amI,
        name;

    setMyData = function (iduser, name) {
        myIduser = iduser;
        myName = name;
        console.log('name set: ' + name);
    };

    setContact = function (contact) {
        contacts[contact.idconversation] = contact;
    };

    setCurrent = function (idconversation) {
        currentConv = idconversation;
    };

    contact = function (idconversation) {
        return contacts[idconversation];
    };

    current = function () {
        return currentConv;
    };

    currentContact = function () {
        return contacts[currentConv];
    };

    eachContact = function (func, compareFunc) {
        if (compareFunc) {
            var sorted = contacts.concat().sort(compareFunc);
            sorted.forEach(func);
        } else {
            contacts.forEach(func);
        }
    };

    isCurrent = function (idconversation) {
        return idconversation == currentConv;
    };

    amI = function (iduser) {
        return iduser == myIduser;
    };

    name = function () {
        console.log('name read');
        return myName;
    };

    return {
        setMyData: setMyData,
        setContact: setContact,
        setCurrent: setCurrent,
        contact: contact,
        current: current,
        currentContact: currentContact,
        eachContact: eachContact,
        isCurrent: isCurrent,
        amI: amI,
        name: name
    };
}());