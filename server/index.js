/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var crypto  = require('crypto');
var http = require('http');

var express = require('express');
var bodyParser = require('body-parser')

var pjson = require('../package.json');

function SmokeServer(config) {
  this.config = config;
  this.rooms = {};

  this.app = express();
  this.app.use(bodyParser.json());
  this.app.get("/",             this.hello.bind(this));
  this.app.post("/rooms",       this.createRoom.bind(this));

  this.server = http.createServer(this.app);
};

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
   * Create a rooms as a point of rendez-vous for users.
   **/
  createRoom: function(req, res) {
    var room = req.param('room') || crypto.randomBytes(16).toString('hex');
    // XXX: what if the room already exists?
    this.rooms[room] = [];
    res.json(200, {room: room});
  },

  run: function(callback) {
    this.server.listen(7665, callback);
  },

  stop: function(callback) {
    this.server.close(callback);
  }
};

module.exports = SmokeServer;

