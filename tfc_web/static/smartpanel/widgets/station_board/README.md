Station Board
=============

A Lobby Screen Widgit that displays train departure information for
a selected station.

Content for this widget is generated server-side and displayed and
refreshed by the widgit.

Content is sourced from National Rail Enquiries Darwin Webservice
(also known as LDB Webservice) <http://www.nationalrail.co.uk/100296.aspx>
in real time. There's a usage limit of 5000 enquiries / hr. The server-side
script caches responses for 30 seconds so that multiple screens all
updating every 30 seconds will only hit the service once for each update
cycle. Access to the Darwin service is authorised by an API key.

The widgit displays a 'Connection issues' banner in response either to
communication problems accessing the backend server or to error
responses returned.