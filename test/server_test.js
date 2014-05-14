/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var crypto = require('crypto');

var expect = require("chai").expect;
var sinon = require("sinon");
var request = require('request');

var SmokeServer = require("../server");
var pjson = require('../package.json');

var host = "http://localhost:7665";
var req = {
  get: function(params, callback) {
    if ((typeof params) === "string")
      params = {url: params};

    params.url = host + params.url;
    request.get(params, callback);
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

  beforeEach(function(done) {
    server = new SmokeServer();
    sandbox = sinon.sandbox.create();

    server.run(done);
  });

  afterEach(function(done) {
    sandbox.restore();
    server.stop(done);
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
      sandbox.stub(crypto, "randomBytes").returns("fake room");

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

});
