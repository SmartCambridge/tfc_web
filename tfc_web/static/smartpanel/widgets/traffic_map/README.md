Traffic Map
===========

A Lobby Screen Widgit that displays a Google Map with overlaid traffic
information.

This widgit uses the Google Maps public API to render the map. This
requires a Google API key which is hard-coded in the JavaScript. There
are 'Referer' limits on the key currently in use which restrict it to
use on 127.0.0.1 and the various tfc-app_x_.cl.cam.ac.uk servers.

Traffic data is refreshed by the Google API on an unspecified basis.
Any error handling is provided by Google.
