Weather
=======

A Lobby Screen Widgit that displays a weather forecast for 
selected locations.

Content for this widget is generated server-side and displayed and
refreshed by the widgit.

Content is sourced from the Uk Met Office's Datapoint service <https://www.metoffice.gov.uk/datapoint>
The forecast appears to be updated every few hours.

Information mapping places onto 'location' codes for the 3 hour forecast 
can be retrieved from the forecast site list feed -- see <https://www.metoffice.gov.uk/datapoint/support/documentation/uk-locations-site-list-detailed-documentation>

Access to Datapoint requires an API key. There's a pre-key usage limit
of 5000 data requests per day and 100 data requests per minute.  The server-side
script caches responses so that multiple screens all
updating every minute will hit the service much less frequently.

The widgit displays a 'Connection issues' banner in response either to
communication problems accessing the backend server or to error
responses returned.