/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var http = require("http");

var expect = require("chai").expect;
var sinon = require("sinon");
var request = require('request');
var EventSource = require('eventsource');

var utils = require('../server/utils');
var SmokeServer = require("../server");
var Rooms = require('../server/rooms');
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

    if (!params.headers['Content-Type'])
      params.headers['Content-Type'] = "application/json";

    request.post(params, callback);
  }
};

describe("Server", function() {
  var server, sandbox, clock;

  before(function(done) {
    server = new SmokeServer();
    server.run(done);
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    clock = sinon.useFakeTimers();
    server.rooms = new Rooms();
  });

  afterEach(function() {
    clock.restore();
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
      sandbox.stub(utils, "generateID").returns("fake room");

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

    it("should destroy the room after a given timeout", function(done) {
      var params = JSON.stringify({room: "foo", ttl: 30});
      var reqOptions = {url: '/rooms', body: params};

      req.post(reqOptions, function (error, response, body) {
        expect(error).to.equal(null);
        expect(response.statusCode).to.equal(200);

        expect(server.rooms.get("foo")).to.not.equal(undefined);
        clock.tick(31000);
        expect(server.rooms.get("foo")).to.equal(undefined);

        done();
      });
    });

    it("should return an error if the content type is not JSON",
      function(done) {
        req.post({
          url: '/rooms',
          headers: {'Content-Type': "text/plain"},
          body: JSON.stringify({room: "foo"}),
        }, function(error, response, body) {
          body = JSON.parse(body);
          expect(response.statusCode).to.equal(400);
          expect(body).to.deep.equal(['application/json']);
          done();
        });
      });

    it("should return a conflict error if the room exists", function(done) {
      var params = JSON.stringify({room: "foo"});
      var reqOptions = {url: '/rooms', body: params};
      server.rooms.create("foo", 60000);

      req.post(reqOptions, function (error, response, body) {
        expect(response.statusCode).to.equal(409);
        done();
      });
    });

  });

  describe("#eventStream", function() {

    beforeEach(function() {
      server.rooms.create("foo", 60000);
    });

    it("should receive an uid-token pair as the first event",
      function(done) {
        var id = sandbox.stub(utils, "generateID");
        id.onCall(0).returns("fake uid");
        id.onCall(1).returns("fake token");
        var source = new EventSource(host + "/rooms/foo");

        source.addEventListener("uid", function(event) {
          var message = JSON.parse(event.data);

          expect(message.uid).to.equal("fake uid");
          expect(message.token).to.equal("fake token");

          source.close();
          done();
        });
      });

    it("should add the user to the room", function(done) {
      var source = new EventSource(host + "/rooms/foo");

      source.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);
        var user = server.rooms.get("foo").users.getByUid(message.uid);
        expect(user).to.not.equal(undefined);

        source.close();
        done();
      });
    });

    it("should notify everyone in the room a new user is here",
      function(done) {
        var id = sandbox.stub(utils, "generateID");
        id.onCall(0).returns("user 1");
        id.onCall(1).returns("token 1");
        id.onCall(2).returns("user 2");
        id.onCall(3).returns("token 2");
        id.onCall(4).returns("user 3");
        id.onCall(5).returns("token 3");
        var user1 = new EventSource(host + "/rooms/foo");
        var user2 = new EventSource(host + "/rooms/foo");
        var user3, nbCalls = 0, id;

        function uid(event) {
          nbCalls += 1;

          if (nbCalls < 2)
            return;

          nbCalls = 0;
          user1.addEventListener("newbuddy", newbuddy.bind(null, "user1"));
          user2.addEventListener("newbuddy", newbuddy.bind(null, "user2"));
          user3 = new EventSource(host + "/rooms/foo");
        }

        function newbuddy(u, event) {
          var message = JSON.parse(event.data);
          nbCalls += 1;

          expect(message.peer).to.equal("user 3");

          if (nbCalls === 2) {
            user1.close();
            user2.close();
            user3.close();
            done();
          }
        };

        user1.addEventListener("uid", uid);
        user2.addEventListener("uid", uid);
      });

    it("should remove the user from the room if he disconnects",
      function(done) {
        var uid = "fake uid"
        var id = sandbox.stub(utils, "generateID");
        id.onCall(0).returns(uid);
        id.onCall(1).returns("fake token");
        var request = req.get('/rooms/foo');

        request.on("response", function(response) {
          var user = server.rooms.get("foo").users.getByUid(uid);
          expect(user).to.not.equal(undefined);
          response.socket.end();
        });
        request.on("end", function() {
          var user = server.rooms.get("foo").users.getByUid(uid);
          expect(user).to.equal(undefined);
          done();
        });
      });

    it("should notify everyone that someone disconnected",
      function(done) {
        var id = sandbox.stub(utils, "generateID");
        id.onCall(0).returns("user 1");
        id.onCall(1).returns("token 1");
        id.onCall(2).returns("user 2");
        id.onCall(3).returns("token 2");
        id.onCall(4).returns("user 3");
        id.onCall(5).returns("token 3");

        var user1 = new EventSource(host + "/rooms/foo");
        var user2 = new EventSource(host + "/rooms/foo");
        var nbCalls = 0;

        function buddyleft(event) {
          var message = JSON.parse(event.data);
          nbCalls += 1;

          expect(message.peer).to.equal("user 3");

          if (nbCalls === 2) {
            user1.close();
            user2.close();
            done();
          }
        };

        user1.addEventListener("buddyleft", buddyleft);
        user2.addEventListener("buddyleft", buddyleft);
        var request = req.get('/rooms/foo');
        request.on("response", function(response) {
          response.socket.end();
        });
      });

    it.skip("should send pings every 20 seconds to keep the connection alive");

    it("should return a 404 if the room does not exist", function(done) {
      req.get('/rooms/bar', function(error, response, body) {
        expect(response.statusCode).to.equal(404);
        done();
      });
    });
  });

  describe("#forwardEvent", function() {

    beforeEach(function() {
      server.rooms.create("foo", 60000);
    });

    it("should forward the posted event to all connected users",
      function(done) {
        var uid = sandbox.stub(utils, "generateID");
        uid.onCall(0).returns("user 1");
        uid.onCall(1).returns("token 1");
        uid.onCall(2).returns("user 2");
        uid.onCall(3).returns("token 2");

        var user1 = new EventSource(host + "/rooms/foo");
        var user2 = new EventSource(host + "/rooms/foo");

        user1.addEventListener("bar", function(event) {
          var message = JSON.parse(event.data);

          expect(message.peer).to.equal("user 2");
          expect(message.some).to.equal("data");

          user1.close();
          user2.close();
          done();
        });

        req.post({
          url: '/rooms/foo',
          body: JSON.stringify({
            type: "bar",
            token: "token 2",
            peer:   "user 1",
            payload: {
              some: "data"
            }
          }),
        }, function(error, response, body) {
          expect(response.statusCode).to.equal(200);
        });

      });

    it("should return an error if the content type is not JSON",
      function(done) {
        req.post({
          url: '/rooms/foo',
          headers: {'Content-Type': "text/plain"},
          body: JSON.stringify({
            type: "bar",
            token: "token 2",
            peer:   "user 1",
            payload: {
              some: "data"
            }
          })}, function(error, response, body) {
            body = JSON.parse(body);
            expect(response.statusCode).to.equal(400);
            expect(body).to.deep.equal(['application/json']);
            done();
          });
      });

    it("should return a 404 if the room does not exist", function(done) {
      req.post({
        url: '/rooms/bar',
        body: JSON.stringify({
          type: "bar",
          token: "token 2",
          peer:   "user 1",
          payload: {
            some: "data"
          }
        })}, function(error, response, body) {
          expect(response.statusCode).to.equal(404);
          done();
        });
    });

    it("should return an error if from is not privided", function(done) {
      req.post({
        url: '/rooms/foo',
        body: JSON.stringify({
          type: "bar",
          peer:   "user 1",
          payload: {
            some: "data"
          }
        })}, function(error, response, body) {
          expect(response.statusCode).to.equal(400);
          done();
        });
    });

    it("should return an error if payload is not an object", function(done) {
      req.post({
        url: '/rooms/foo',
        body: JSON.stringify({
          type: "bar",
          token: "token 2",
          peer:   "user 1",
          payload: "xoo"
        })}, function(error, response, body) {
          expect(response.statusCode).to.equal(400);
          done();
        });
    });


  });

});
