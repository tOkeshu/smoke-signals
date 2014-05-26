/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var crypto  = require('crypto');
var http = require('http');

var express = require('express');
var bodyParser = require('body-parser');

var pjson = require('../package.json');
var serverSentEvents = require('./sse');

function SmokeServer(config) {
  this.config = config;
  this.rooms = {};

  this.app = express();
  this.app.use(bodyParser.json());
  this.app.use(serverSentEvents);
  this.app.get("/",             this.hello.bind(this));
  this.app.post("/rooms",       this.createRoom.bind(this));
  this.app.get("/rooms/:room",  this.eventStream.bind(this));
  this.app.post("/rooms/:room", this.forwardEvent.bind(this));

  this.server = http.createServer(this.app);
}

SmokeServer.prototype = {
  /**
   * Displays some version information at the root of the service.
   **/
  hello: function(req, res) {
    var infos = {
      name: pjson.name,
      description: pjson.description,
      version: pjson.version,
      endpoint: req.protocol + "://" + req.get('host')
    };

    res.json(200, infos);
  },

  /**
   * Create a room as a point of rendez-vous for users.
   **/
  createRoom: function(req, res) {
    var room = req.param('room') || this._UID();
    // XXX: what if the room already exists?
    this.rooms[room] = {};
    res.json(200, {room: room});
  },

  eventStream: function(req, res) {
    var room = req.param('room');
    var users = this.rooms[room];
    var uid = this._UID();
    var timer;

    req.on("close", function() {
      var users = this.rooms[room];
      delete users[uid];
      clearInterval(timer);

      for (var user in users)
        users[user].sse("buddyleft", {peer: uid});
    }.bind(this));

    res.sse("uid", {uid: uid});

    // we send a ping comment every n seconds to keep the connection
    // alive.
    timer = setInterval(function() {
      res.ssePing();
    }, 20000);

    for (var user in users)
      users[user].sse("newbuddy", {peer: uid});

    users[uid] = res;
  },

  forwardEvent: function(req, res) {
    var from  = req.get('X-SMOKE-UID');
    var room  = req.param('room');
    var users = this.rooms[room];
    var event = req.body;
    var type  = req.param('type');

    var user = users[event.peer];
    event.peer = from;
    user.sse(type, event);

    res.send(200, "ok");
  },

  run: function(callback) {
    this.server.listen(7665, callback);
  },

  stop: function(callback) {
    this.server.close(callback);
  },

  _UID: function() {
    return crypto.randomBytes(16).toString("hex");
  }
};

module.exports = SmokeServer;

