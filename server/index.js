var crypto  = require('crypto');
var express = require('express');
var bodyParser = require('body-parser')

var pjson = require('../package.json');

var app = express();
var rooms = {};

app.use(bodyParser.json());

/**
 * Displays some version information at the root of the service.
 **/
app.get("/", function(req, res) {
  var credentials = {
    name: pjson.name,
    description: pjson.description,
    version: pjson.version,
    homepage: pjson.homepage,
    endpoint: req.protocol + "://" + req.get('host')
  };

  res.json(200, credentials);
});

app.listen(7665);
console.log('Listening on port 7665');

