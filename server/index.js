/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var http = require('http');

var express = require('express');
var bodyParser = require('body-parser');

var pjson = require('../package.json');
var serverSentEvents = require('./sse');
var Rooms = require('./rooms');
var utils = require('./utils');

function requireJSON(req, res, next) {
  if (req.method !== "POST") {
    next();
    return;
  }

  if (req.get("Content-Type").indexOf("application/json") === -1) {
    res.json(400, ['application/json']);
    return;
  }

  next();
}


function SmokeServer(config) {
  this.config = config;
  this.rooms = new Rooms();

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
    var roomId = req.param('room') || utils.generateID();
    var ttl    = req.param('ttl') || 60;
    ttl = ttl * 1000;

    if (this.rooms.get(roomId)) {
      res.json(409, "");
      return;
    }

    var room = this.rooms.create(roomId, ttl);
    room.on("timeout", function() {
      room.stopHeartbeat();
      this.rooms.remove(roomId);
    }.bind(this));

    room.on("heartbeat", function() {
      room.users.forEach(function(user) {
        user.connection.ssePing();
      });
    }.bind(this));

    room.startHeartbeat();
    room.timeoutAfter(room.ttl);

    res.json(200, {room: roomId});
  },

  eventStream: function(req, res) {
    var roomId = req.param('room');
    var room, pinger;

    room = this.rooms.get(roomId);
    if (room === undefined) {
      res.json(404, "");
      return;
    }

    var peer = room.users.create(res);
    room.clearTimeout();

    peer.connection.sse("uid", {uid: peer.uid, token: peer.token});
    peer.on("disconnection", function() {
      room.users.remove(peer);
      clearInterval(pinger);

      room.users.forEach(function(user) {
        user.connection.sse("buddyleft", {peer: peer.uid});
      });

      if (room.empty())
        room.timeoutAfter(room.ttl);
    });

    room.users.forEach(function(user) {
      if (user === peer)
        return;

      user.connection.sse("newbuddy", {peer: peer.uid});
    });
  },

  forwardEvent: function(req, res) {
    var roomId  = req.param('room');
    var event   = req.body;
    var room    = this.rooms.get(roomId);
    var user, peer;

    if (room === undefined) {
      res.json(404, "");
      return;
    }

    user = room.users.getByToken(event.token);
    peer = room.users.getByUid(event.peer);
    if (user === undefined || peer === undefined) {
      res.json(400, "");
      return;
    }

    if ((typeof event.payload) !== "object") {
      res.json(400, "");
      return;
    }

    event.payload.peer = user.uid;
    peer.connection.sse(event.type, event.payload);

    res.send(200, "ok");
  },

  run: function(callback) {
    this.server.listen(7665, callback);
  },

  stop: function(callback) {
    this.server.close(callback);
  },
};

module.exports = SmokeServer;

