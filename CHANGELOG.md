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

