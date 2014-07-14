/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EventEmitter = require("events").EventEmitter;
var inherits = require("util").inherits;
var utils = require("./utils");

function User(uid, token, connection) {
  this.uid        = uid;
  this.token      = token;
  this.connection = connection;

  this.connection.on("close", function() {
    this.emit("disconnection");
  }.bind(this));

  EventEmitter.call(this);
}

inherits(User, EventEmitter);

function Users() {
  this.users  = {};
  this.tokens = {};
}

Users.prototype = {
  create: function(connection) {
    var uid            = utils.generateID();
    var token          = utils.generateID();
    var user           = new User(uid, token, connection);

    this.users[uid]    = user;
    this.tokens[token] = user;

    return user;
  },

  add: function(user) {
    this.users[user.uid] = user;
    this.tokens[user.token] = user;
  },

  remove: function(user) {
    delete this.users[user.uid];
    delete this.tokens[user.uid];
  },

  forEach: function(callback) {
    for (var uid in this.users)
      callback(this.users[uid]);
  },

  getByUid: function(uid) {
    return this.users[uid];
  },

  getByToken: function(token) {
    return this.tokens[token];
  },

  size: function() {
    return Object.keys(this.users).length;
  }
};

module.exports = Users;

