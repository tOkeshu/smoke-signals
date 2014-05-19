/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var http = require("http");

var expect = require("chai").expect;
var sinon = require("sinon");
var request = require('request');
var EventSource = require('eventsource');

var SmokeServer = require("../server");
var pjson = require('../package.json');

var host = "http://localhost:7665";
var req = {
  get: function(params, callback) {
    if ((typeof params) === "string")
      params = {url: params};

    params.url = host + params.url;
    return request.get(params, callback);
  },

  post: function(params, callback) {
    if ((typeof params) === "string")
      params = {url: params, headers: {}};

    params.url = host + params.url;
    params.headers = params.headers || {};
    params.headers['Content-Type'] = "application/json";
    request.post(params, callback);
  }
};

describe("Server", function() {
  var server, sandbox;

  before(function(done) {
    server = new SmokeServer();
    server.run(done);
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    server.rooms = {};
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe("#hello", function() {

    it("should successfully return relevant informations", function(done) {
      req.get('/', function (error, response, body) {
        var infos;
        expect(error).to.equal(null);
        expect(response.statusCode).to.equal(200);

        infos = JSON.parse(body);
        expect(infos).to.deep.equal({
          name: pjson.name,
          description: pjson.description,
          version: pjson.version,
          endpoint: "http://localhost:7665"
        });

        done();
      });
    });

  });

  describe("#createRoom", function() {
    it("should create a new room", function(done) {
      sandbox.stub(server, "_UID").returns("fake room");

      req.post('/rooms', function (error, response, body) {
        expect(error).to.equal(null);
        expect(response.statusCode).to.equal(200);

        var answer = JSON.parse(body);
        expect(answer).to.deep.equal({room: "fake room"});

        done();
      });
    });

    it("should create a new room with the given id", function(done) {
      var params = JSON.stringify({room: "foo"});
      var reqOptions = {url: '/rooms', body: params};

      req.post(reqOptions, function (error, response, body) {
        expect(error).to.equal(null);
        expect(response.statusCode).to.equal(200);

        var answer = JSON.parse(body);
        expect(answer).to.deep.equal({room: "foo"});

        done();
      });
    });
  });

  describe("#eventStream", function() {

    beforeEach(function() {
      server.rooms["foo"] = {};
    });

    it("should receive an uid as the first event",
      function(done) {
        var source = new EventSource(host + "/rooms/foo");

        source.addEventListener("uid", function(event) {
          var message = JSON.parse(event.data);

          expect(message.uid).to.be.a("string");

          source.close();
          done();
        });
      });

    it("should add the user to the room", function(done) {
      var source = new EventSource(host + "/rooms/foo");

      source.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);
        var conn = server.rooms["foo"][message.uid];
        expect(conn).to.be.an.instanceOf(http.ServerResponse);

        source.close();
        done();
      });
    });

    it("should notify everyone in the room a new user is here",
      function(done) {
        var user1 = new EventSource(host + "/rooms/foo");
        var user2 = new EventSource(host + "/rooms/foo");
        var user3, nbCalls = 0, uid = "fake uid";

        function newbuddy(event) {
          var message = JSON.parse(event.data);
          nbCalls += 1;

          expect(message.peer).to.equal(uid);

          if (nbCalls === 2) {
            user1.close();
            user2.close();
            user3.close();
            done();
          }
        };

        user1.addEventListener("newbuddy", newbuddy);
        user2.addEventListener("newbuddy", newbuddy);

        sandbox.stub(server, "_UID").returns(uid);
        user3 = new EventSource(host + "/rooms/foo");
      });

    it("should remove the user from the room if he disconnects",
      function(done) {
        var uid = "fake uid", request;
        sandbox.stub(server, "_UID").returns(uid);
        request = req.get('/rooms/foo');

        request.on("response", function(response) {
          var conn = server.rooms["foo"][uid];
          expect(conn).to.be.an.instanceOf(http.ServerResponse);
          response.socket.end();
        });
        request.on("end", function() {
          var conn = server.rooms["foo"][uid];
          expect(conn === undefined).to.equal(true);
          done();
        });
      });

    it("should notify everyone that someone disconnected",
      function(done) {
        var uid = sandbox.stub(server, "_UID");
        uid.onCall(0).returns("user 1");
        uid.onCall(1).returns("user 2");
        uid.onCall(2).returns("user 3");

        var user1 = new EventSource(host + "/rooms/foo");
        var user2 = new EventSource(host + "/rooms/foo");
        var nbCalls = 0;

        function buddyleft(event) {
          var message = JSON.parse(event.data);
          nbCalls += 1;

          expect(message.peer).to.equal("user 3");

          if (nbCalls === 2)
            done();
        };

        user1.addEventListener("buddyleft", buddyleft);
        user2.addEventListener("buddyleft", buddyleft);
        request = req.get('/rooms/foo');
        request.on("response", function(response) {
          response.socket.end();
        });
      });

    it.skip("should send pings every 20 seconds to keep the connection alive");
  });

});
