var convict = require('convict');

var config = convict({
  ip: {
    doc: "The IP address to bind.",
    format: "ipaddress",
    default: "127.0.0.1",
    env: "IP_ADDRESS",
  },
  port: {
    doc: "The port to bind.",
    format: "port",
    default: 7665,
    env: "PORT"
  }
});


config.loadFile(process.cwd() + '/config.json');
config.validate();

module.exports = config;

