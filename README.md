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

    $ curl -X POST http://localhost:7665/rooms
    {"room": "3d56a9d9b2b8709fa5874d2907542e4a"}

    $ curl -X POST http://localhost:7665/rooms --header "Content-Type: application/json" --data '{"room": "foo"}'
    {"room": "foo"}

Listen for events in a room:

    $ curl -X GET http://localhost:7665/rooms/3d56a9d9b2b8709fa5874d2907542e4a

    event: uid
    data: {"uid": "3d56a9d9b2b8709fa5874d2907542e4a"}

    event: newbuddy
    data: {"peer": "3d56a9d9b2b8709fa5874d2907542e4a"}


License
-------

Smoke Signals are released under the
[Mozilla Public License 2.0](http://www.mozilla.org/MPL/2.0/)

