# SmartCambridge SmartPanel Framework

_Version 6_

This directory contains the widgets for the SmartCambridge SmartPanel
Framework.

## Installation of new widgets

To install a new widget just copy and paste the widget folder inside
this folder. The SmartPanel Framework will automatically recognise it and
it will be ready to use. You will have to redeploy tfc_web and execute
collectstatic.

## Widget requirements

There are some requirements that the widgets need to follow in order to
work with the framework:

1. Each widget has a _`<name>`_ by which it is known, for example
`station_board`. The name should be short and not contain spaces.

2. The files making up a widget should be stored in a directory named
_`<name>`_.

3. Within this directory, the following files will be recognised:

    1. _`<name>.js`_

        A JavaScript file containing the definition of the
        widget. Further details of this appear below.

    2. _`<name>.css`_

        A file containing CSS definitions which, if present, will be
        included into any page that displays this widget.

        To avoid name clashes, the page element into which the widget
        is loaded automatically has a class of _`<name>`_. This can be
        targeted directly by CSS selectors - all widget-specific rules
        must include this as a prefix to their selectors. For example

        ```
        .station_board { ....; ....; }
        .station_board table { ...; ...; }
        ```

        The page displaying the widget will establish suitable style
        defaults (including a default body font size) which should be
        relied on where possible to promote visual conformity
        between widgets. Widget-specific styles should
        use relative dimensions such as ems, rems or percentages so that
        they can adapt (where appropriate) to different body font sizes
        and display areas. The page element containing the widget has
        `position: relative` set and so will form the context for any
        subsequent positioned elements.

        Widgets are currently displayed on a grid with columns 320px
        wide and rows 255px high but should attempt to work in any
        reasonable area.

    3. _`<name>.html`_

        _`<name>.html`_ files are no longer (in fact never were) supported.

    4. _`<name>_schema.json`_

        _`<name>_schema.json`_ files are no longer used.

    5. _`requirements.json`_

        A file listing additional JavaScript files and
        stylesheets that need to be loaded to make the widget work. If
        present, this file must contain an object with keys "scripts"
        and/or "stylesheets". Each of these must contain an array whose
        elements are either:

        * Objects containing keys "src" and (optionally) "integrity"
          (for scripts) or "href" and (optionally) "integrity" (for
          stylesheets) with appropriate values, for non local
          dependencies; or
        * Strings containing local file names, resolved relative to
          the widget directory

        An example of such a file appears below. Non-local dependencies
        must be included using the object syntax even if they don't
        have an "integrety" hash. Non-local resources are
        loaded before the corresponding local ones.

        A copy of jQuery will automatically be available and a request
        for this shouldn't appear in requirements.

    6. _`README.md`_

        An optional documentation file for the widget.

The widget directory may contain other files. These will be
web-accessible and can be referenced by other components by relative URLs
(from HTML and CSS files) or via the `static_url`
widget configuration parameter (for JavaScript files).

## DEBUG

## Widget JavaScript objects


## Widget JavaScript objects

## Widget JavaScript objects

Each widget is implemented by a JavaScript object presenting the interface
below. The object must have a name based based on _`<name>`_ (see above)
but in camel case omiting any '\_' characters - for example `StationBoard`
for a widget called `station_board`.

### Data structures

#### `params_object`

Some methods receive or return a `params_object`. This is an object
supporting JSON serialisation representing the parameters of a
particular instance of a particular widget. Its structure and content
is opaque to the method's caller.

#### `config_object`

Some methods receive a `config_object`. This is an object containing
generic configuration information supplied by the method's caller. It
contains the following keys:

* `container_id`: the id of the DOM object within which
  the widget or it's configuration page must be displayed.
  [string, required, commonly based on `widget_id`]
* `static_url`: URL prefix via which the content of the widget
  source directory can be accessed. [string, required]
* `height`: the height in pixels of the area that the widget occupies
  in the current layout [integer, optional]
* `width`: the width in pixels of the area that the widget occupies
  in the current layout [integer, optional]
* `settings`: an object containing a copy of configuration parameters
  inherited from the enclosing framework's setup. Only parameters with
  names starting `SMARTPANEL_` are included [object, required]. Currently
  used values:
      * `SMARTPANEL_API_ENDPOINT`: URL base for the TFC transport API
      * `SMARTPANEL_API_TOKEN`: Access token for the API

### Constructor

`ExampleWidget(widget_id)` (required)

This may be called before DOM construction is complete and so shouldn't
reference any DOM objects.

#### Parameters:

* `widget_id`: a unique id for this instance of the widget (string, required)

### Methods

* `display(config_object, params_object)` (required)

  Display or re-display the widget. If present, this will be
  called after DOM construction is complete and all widgets have
  been instantiated. This method may assume
  responsibility for refreshing the widget in the future,
  otherwise there should be a `refresh()` method that
  does this (see below).

  This method may be called more than once on any particular
  widget instance. When called a second and subsequent time the
  method must re-initialise data structures,
  cancel running timers, un-subscribe from external
  subscriptions, etc.

  #### Parameters:

  * `config_object`: the display configuration for the widget
    [`config_object`, required].
  * `params_object`: the parameters for this widget instance.
    [`params_object`, required]

  This method has no return value.

* `refresh()` (optional)

  Refresh the widget display. If present, this will be
  periodically called after the widget has been initialised and
  will typically arrange to update the widget's content.

  This method has no return value.

* `obj = configure(config_object, current_params_object)` (required)

  Render a configuration screen for the widget (initialised
  with current parameters if there are any), collect and validate
  new parameters and return them.

  #### Parameters

  * `config_object`: the display configuration for the widget
    [`config_object`, required].
  * `current_params_object`: the current parameters for the widget instance
    being edited. [`params_object`, required]

  #### Return value

  An object containing the following keys:

  * `valid`: a parameterless function which when called
     will trigger validation of the current values and return
     `true` if they were valid and `false` if not. If the
     function returns `false` then the widget should alert
     the user to the problems. [boolean,
     required]
  * `value`: a parameterless function which when called returns
     a `params_object` containing the new or updated
     configuration. [required]
  * `config`: a parameterless function which when called returns an object 
     containing the folowing keys [object, required]:
      * `title`: a short text description of this configuration [required]

### Other properties

Explicitly none -- these objects have no other externally-accessible properties.

### Environment

Other than it's own name, widgets must not create any new names in
the JavaScript global context.

Widgets can assume that a copy of jQuery is available and must not
include this in their `requirements.json` file.

Widgets may assume the existance of a global `RTMONITOR_API` containing
an instance of the RT Monitor API.

Widgets may assume the existence of a global `DEBUG` which will contain
'_`<name>_log`_' to request verbose logging by the widget.

## Example `requirements.json` file

```json
{
    "scripts": [
      { "src": "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.20.1/moment.min.js",
        "integrity": "sha256-ABVkpwb9K9PxubvRrHMkk6wmWcIHUE9eBxNZLXYQ84k="
      },
      { "src": "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js" },
      "js/geo.js"
    ],
    "stylesheets": [
      { "href": "https://unpkg.com/leaflet@1.0.1/dist/leaflet.css",
        "integrity": "sha512-Rksm5RenBEKSKFjgI3a41vrjkw4EVPlJ3+OiI65vTjIdo9brlAacEuKOiQ5OFh7cOI1bkDwLqdLw3Zg0cRJAAQ=="
      },
      { "href": "https://example.com/magic-stylesheet.css" },
      "css/special.css"
    ]
}
```
