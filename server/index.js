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

function requireJSON(req, res, next) {
  if (req.method !== "POST") {
    next();
    return;
  }

  if (req.get("Content-Type") !== "application/json") {
    res.json(400, ['application/json']);
    return;
  }

  next();
}


function SmokeServer(config) {
  this.config = config;
  this.rooms = {};

  this.app = express();
  this.app.use(bodyParser.json());
  this.app.use(requireJSON);
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

    if (this.rooms[room]) {
      res.json(409, "");
      return;
    }

    this.rooms[room] = {};
    res.json(200, {room: room});
  },

  eventStream: function(req, res) {
    var room = req.param('room');
    var users = this.rooms[room];
    var uid, timer;

    if (users === undefined) {
      res.json(404, "");
      return;
    }

    uid = this._UID();

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
    var room  = req.param('room');
    var users = this.rooms[room];
    var event = req.body;

    if (users === undefined) {
      res.json(404, "");
      return;
    }

    var user = users[event.to];
    event.payload.from = event.from;
    user.sse(event.type, event.payload);

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

