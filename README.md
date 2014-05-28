Smoke Signals
=============

This is a simple WebRTC signaling server.

Usage
-----

Infos:

    $ curl -X GET http://localhost:7665/
    {
      "name": "smoke-signals",
      "description": "A simple WebRTC signaling server",
      "version":"0.0.1",
      "endpoint":"http://localhost:7665"
    }

Create a room:

    $ curl -X POST http://localhost:7665/rooms --header "Content-Type: application/json"
    {"room": "3d56a9d9b2b8709fa5874d2907542e4a"}

    $ curl -X POST http://localhost:7665/rooms --header "Content-Type: application/json" --data '{"room": "foo"}'
    {"room": "foo"}

Listen for events in a room:

    $ curl -X GET http://localhost:7665/rooms/3d56a9d9b2b8709fa5874d2907542e4a

    event: uid
    data: {"uid": "3d56a9d9b2b8709fa5874d2907542e4a", "token": "0ca598dd0627a091342705f05d38124d"}

    event: newbuddy
    data: {"peer": "3d56a9d9b2b8709fa5874d2907542e4a"}

Send an event to someone (here it sends an event `bar` to user `xoo`:

    $ curl -X POST http://localhost:7665/rooms/3d56a9d9b2b8709fa5874d2907542e4a --header "Content-Type: application/json" " --data '
    {
      "type": "bar",
      "token": "bf1a3a352ff95302bf2ca81504c141f7",
      "to": "3d56a9d9b2b8709fa5874d2907542e4a",
      "payload": {
        "arbitrary": "data"
      }
    }'

License
-------

Smoke Signals are released under the
[Mozilla Public License 2.0](http://www.mozilla.org/MPL/2.0/)

