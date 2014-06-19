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
  this.tokens = {};

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
    var room = req.param('room') || this._generateID();
    var ttl  = req.param('ttl') || 60;
    ttl = ttl * 1000;

    if (this.rooms[room]) {
      res.json(409, "");
      return;
    }

    var timeout = setTimeout(function() {
      delete this.rooms[room];
    }.bind(this), ttl);
    this.rooms[room] = {users: {}, ttl: ttl, timeout: timeout};

    res.json(200, {room: room});
  },

  eventStream: function(req, res) {
    var room = req.param('room');
    var users, uid, token, timer;

    if (this.rooms[room] === undefined) {
      res.json(404, "");
      return;
    }

    users = this.rooms[room].users;
    uid   = this._generateID();
    token = this._generateID();

    req.on("close", function() {
      var users = this.rooms[room].users;
      delete users[uid];
      delete this.tokens[token];
      clearInterval(timer);

      var nbUsers = 0;
      for (var user in users) {
        users[user].sse("buddyleft", {peer: uid});
        nbUsers += 1;
      }
      if (nbUsers === 0) {
        var timeout = setTimeout(function() {
          delete this.rooms[room];
        }.bind(this), this.rooms[room].ttl);
        this.rooms[room].timeout = timeout;
      }
    }.bind(this));

    res.sse("uid", {uid: uid, token: token});

    // we send a ping comment every n seconds to keep the connection
    // alive.
    timer = setInterval(function() {
      res.ssePing();
    }, 20000);

    for (var user in users)
      users[user].sse("newbuddy", {peer: uid});
    clearTimeout(this.rooms[room].timeout);

    users[uid] = res;
    this.tokens[token] = uid;
  },

  forwardEvent: function(req, res) {
    var room  = req.param('room');
    var event = req.body;
    var from  = this.tokens[event.token];
    var users, user;

    if (this.rooms[room] === undefined) {
      res.json(404, "");
      return;
    }
    if (!from) {
      res.json(400, "");
      return;
    }
    if ((typeof event.payload) !== "object") {
      res.json(400, "");
      return;
    }

    users = this.rooms[room].users;
    user  = users[event.peer];
    event.payload.peer = from;
    user.sse(event.type, event.payload);

    res.send(200, "ok");
  },

  run: function(callback) {
    this.server.listen(7665, callback);
  },

  stop: function(callback) {
    this.server.close(callback);
  },

  _generateID: function() {
    return crypto.randomBytes(16).toString("hex");
  }
};

module.exports = SmokeServer;

