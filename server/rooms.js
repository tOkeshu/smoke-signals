/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EventEmitter = require("events").EventEmitter;
var inherits = require("util").inherits;
var Users = require("./users");

function Room(roomId, ttl) {
  this.roomId   = roomId;
  this.ttl      = ttl;
  this.users    = new Users();
  this.timer    = undefined;

  EventEmitter.call(this);
}

inherits(Room, EventEmitter);

Room.prototype.empty = function() {
  return this.users.size() === 0;
};

Room.prototype.timeoutAfter = function(timeout) {
  this.timer = setTimeout(function() {
    this.emit("timeout");
  }.bind(this), timeout);
};

Room.prototype.clearTimeout =  function() {
  clearTimeout(this.timer);
};

Room.prototype.startHeartbeat = function(timeout) {
  this.hearbeat = setInterval(this.emit.bind(this, "heartbeat"), 20000);
};

Room.prototype.stopHeartbeat = function() {
  clearInterval(this.hearbeat);
};

function Rooms() {
  this.rooms = {};
}

Rooms.prototype = {
  get: function(roomId) {
    return this.rooms[roomId];
  },

  create: function(roomId, ttl) {
    var room = new Room(roomId, ttl);
    this.rooms[roomId] = room;
    return room;
  },

  remove: function(roomId) {
    delete this.rooms[roomId];
  }
};

module.exports = Rooms;

