Iframe Area
===========

A Lobby Screen Widgit that displays another web page in an \<iframe\>.

Most web pages probably aren't going to display well in the
area available to a widget, but this could be useful for displaying
something specialised from a custom page.

The \<iframe\> content is periodically refreshed by reloading the frame.

Note that target page mustn't be prevented from appearing in an
\<iframe\>, e.g. by a `X-Frame-Options:SAMEORIGIN` HTTP header.

There's no particular error handling for this widget - if the target
page isn't available the widget will display a server-generated or
browser-generated error message. The browser's JavaScript console may
shed further light on any failure.

