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

