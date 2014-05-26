/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

function serverSentEvents(req, res, next) {
  res.sse = function(type, event) {
    if (!res.headersSent) {
      res.writeHead(200, {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive"
      });
      // send a dummy comment to ensure that the head is flushed
      res.write(':\n');
    }

    if (type)
      res.write("event: " + type + "\n");
    res.write("data: " + JSON.stringify(event) + "\n\n");
  };

  res.ssePing = function() {
    res.write(":p\n\n");
  };

  next();
}

module.exports = serverSentEvents;
