## Release 15 (2019-05-30)

# User visible changes

* [#320] Rework the car park capacity indication on the car park graphs to cope with capacity changes over time; drop spaces_capacity from car park metadata returned by the API because returning a single value is misleading.

# Non user visible changes

* [#318] Upgrade django-rest-framework to at least 3.9.1 and Django to at least 1.11.6

## Release 14 Bugfix 1 (2019-05-13)

Add selected camera icons

## Release 14 (2019-05-06)

Added a new traffic flow tool to analyse traffic flows across Cambridge using data from the ANPR cameras.

## Release 13 Bugfix 2 (2019-04-17)

* Fix issue #309 that caused all the links on https://smartcambridge.org/transport/lines/ to fail

* Update logging configuration not to send email notification of errors from development machines

## Release 13 Bugfix 1 (2019-04-15)

* Fix syntax error in tfc_web/transport/views.py

## Release 13 (2019-04-15)

# User visible changes

* Rework station_board view to better cope with errors and reuse the last successfully retrieved data if the upstream data source fails

# Non user visible changes

* Fix obscure bug in the RSS SmartPanel widget which could cause the widget to crash

* Work around problems when more than one TNDS data file contains information for the same bus line

* Move various 'debug' views of bus route information into a separate 'debug' namespace, and fix them to return 404 Not Found when an object isn't found rather than throwing an error

## Release 12 Bugfix 1 (2019-03-27)

* Update aq, transport and parking views to return 404 Not Found rather than Internal Server Error if the sensor, zone or car park id doesn't exist

* Add custom email format for exception reports

* Fix redundant reference to 'title' in RSS widget error handling

* Add pre-defined Pocket SmartPanel configurations for bus stops at Shire Hall

## Release 12 (2019-03-06)

# User visible changes

* Bus Stop web view now uses smartpanel bus stop widget and bus timetable widget.

* New Cambridge Sensor Network 2.0:
  + Applications are now Connections. This is where the user receives the data that their sensors produce.
  + Users now have to submit the APP_EUI field that they are using in their devices.
  + New UI for adding Devices/Sensors to Connections
  + Email to user when their new Connection has been approved by administrators.

# Non user visible changes

* Updated sockjs to use 1.3.0

* Adjust default height/width of the SmartPanel 'iframe' display so more content will display correctly

* Stop using Errorception to log Javascript errors in the Pocket Smartpanel

* Cambridge Sensor Network 2.0
  - New APIs for Everynet
  - Autocreation of Filters when a new Connection is configured.
  - Autoupdate of Filters when new sensors/devices are added or removed to a Connection.
  - New admin section linking devices and connections to the Everynet portal
  - New management workflow for processes where there is no corresponding API in the Everynet portal API.
  - Simplified database, tfcserver is no longer user
  - Simplified code, tfcserver API (and the corresponding Everynet vertex) is no longer used.

## Release 11 (2019-02-04)

User facing changes
---------------------

* Rework the query in the stops API endpoint to work significantly faster

* Increase the maximum number of pages to return in the stops API endpoint from default 25, max 50 to default 250, max 500

* Change the bus stop chooser used in SmartPanel configuration to show bus stops as clusters at low zoom levels to stop the interface slowing down due to handling too many markers

* Replace the non-functioning bus stop list at /transport/stops with a map based on the bus stop chooser

* Fix a bug that prevented the configuration of CSN destinations from updating when they were changed on the web site

* Fix a bug that prevented CSN devices with DevEUIs using upper case letters from being deleted

* Fix a bus that prevented OTAA activation from working

Others
-------

* Remove unused transport area endpoints

* Simplify JavaScript library dependancy management for SmartPanel widgets and prevent loading of duplicate libraries

* Correct the location of the bus_stop template

## Release 10 (2019-01-18)

User facing changes
-------------------

* Further Pocket SmartPanel changes:
    * Shutdown realtime data feed when pages loose focus (doesn't happen by default on Android)
    * Add debug display of last load time
    * Remove page edit functionality
    * Add optional config preload functionality via URL parameter

* Limit running SmartPanel layouts (as opposed to displays) to 10 min (to avoid developers ending up with multiple running tabs)

* Add token protection of RTMonitor end point

Others
------

* Move logger endpoint; expand logger use in Pocket SmartPanel

* Switch APIs to use PostGIS queries for bounding box filtering

* Further Gunicorn reconfiguration changes:
    * Move config to a file
    * Reduce workers and threads-per-worker
    * Enable max_requests
    * Add request time to access log
    * Add metrics via statsD
    * Create a PID file

* Switch to using RTmonitor endpoint on smartcambridge.org (from test endpoint on tfc-app2)

## Release 9 (2019-01-06)

User facing changes
---------------------

* Added the option to include platform numbers on the train timetable widget and made this the default in the Pocket SmartPanel (though existing panels need to be recreated to pick this up).

* Fixed vertical layout fault on Pocket SmartPanels.

* Migration of the Cambridge Sensor Network section to use the new Everynet platform and new Everynet APIs

* Add experimental support for tracking Ofo and Mobike bikes, and a map and Smartpanel widget showing their locations

Others
-------

* Switch to loading local cached copy of TNDS WSDL files directly from the filesystem.

* Rework instance_id to be in the form 'AAAA-0000' and replace any existing all-numeric ids.

* Log instance_id to a dedicated logging endpoint each time the app starts up.

* New configuration for Gunicorn (logging and performance)

## Release 8 (2018-12-15)

This is a rollup 'release', documenting various things that have been pushed to production up to and including the release date.

* Added 'Pocket SmartPanels'

* Added experimental 'RSS Reader' SmartPanel widget

* Added loading spinner to the Bus Stop Timetable widget

* Added 'Real-time data missing' warning to journeys that should have started but for which we have no real-time data

* Download a snapshot of current real-time data before displaying Stop Timetable and Bus Stop Map so that they start up immediately, rather than having to wait until each bus reports in

* Add retrying of timetable loading if it fails at startup

* Tidied 'Connection error' error banner for widgets that aren't loading properly; fixed non-display of the banner on the Station Board and Wether widgets on first load

* Improved resilience of Station Board by using a local copy of WSDL files

* Make widgets work on a wider range of browsers (especially common mobile ones)

* Add explicit MIT licence to the tfc_web code

* Added stations and wether regions

* Improved formatting of bus stop names

* Removed jQuery dependency from Weather and Station Board widgets

* Add 'close' action for widgets to let them cleanup timers and data subscriptions

* Re-work RTMonitor_api to support closing subscriptions and connections

* Setup ESLint rules for JS development

* Update version of Requests library to address reported vulnerability

* Further improve resilience of bus timetable import code by not assuming uniqueness of identifiers between regions

* Added logging of faulty responses from the upstream API

## Release 7 bugfix / minor updates (2018-10-29)

* removed fixed-width limitations on some plot and map templates

* smartpanel removed 'New Layout' and 'New Display' from left menu (as user has 'New' card on Layouts / Displays pages).

* smartpanel BusStopsChooser bugfix - trailing slash added to 'transport/stops/' API call

## Release 7 (2018-09-11)

* smartpanel 'displays map' page moved to 'displays list' + 'displays map', with list as the default for 'My displays'

* smartpanel various updates to displays lists to advertise the slug/URL for the display

* smartpanel layout config supports landscape/portrait with grid sizes 6x4 (as before) 
  plus 9x6, 12x8, 'design' json changed from 'list of widget configs' to { grid: 'grid info', widgets: 'list of widget configs' }

* smartpanel template code `layout/layout_config` cleaned up so gridstack on `layout_config` and no gridster left on layout.

* smartpanel layout (i.e. display, not config) now dynamically resizes to fill screen, no 1920x1080 fixed size

* IframeArea widget adds X and Y offset parameters (in addition to url and scale)

* removed legacy code from `transport` app (urls, views, templates)

* deleted old-bus-map, removing legacy DataServer API dependency

* removed erroneous `Zone` link on main menu

* Added ability to associate authorised referers with tokens

* Requires authentication and rate throttling for access to the Transport API endpoints

• Requires T&C'ss agreement before accessing any of the API

* Added `setup_tfc_prod` management command to set up API tokens for use by the `tfc_web` code, replacing 
  the stand-alone script that just set `TFC_WEB INTERNAL`. Adds additional secrets.

* Passes one of these tokens (`TFC_WEB JS`) into the SmartPanel code to authenticate access by widgets 
  and by widget configuration to the transport API. In the process, implement an earlier proposal that
  all Django config items with names starting `SMARTPANEL_` are passed to widgets in the `settings` 
  object of their config parameter, and use this to also pass the URL of the API endpoint that widgets 
  should use.

* Significantly revised and hopefully improved the API documentation

* Add front page links to the API (essentially releasing it to publici)

* moved smartpanel static files into `smartpanel/static/smartpanel`

* modified Django templates to refer to common `templates/base.html`

