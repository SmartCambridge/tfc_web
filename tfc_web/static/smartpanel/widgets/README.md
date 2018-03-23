# SmartCambridge SmartPanel Framework

This directory contains the widgets for the SmartCambridge SmartPanel
Framework.

## Installation of new widgets

To install a new widget just copy and paste the widget folder inside
this folder. The SmartPanel Framework will automatically recognise it and
it will be ready to use. You will have to redeploy tfc_web and execute
collectstatic.

## Widget requirements (version 0.5)

There are some requirements that the widgets need to follow in order to
work with the framework:

1. Each widget has a _`<name>`_ by which it is known, for example
`station_board`. The name should be short and not contain spaces.

2. The files making up a widget should be stored in a directory named
_`<name>`_.

3. Within this directory, the following files will be recognised. All
are optional, but a widget with no files won't do anything.

    1. _`<name>.js`_

        A JavaScript file containing an object definition for the
        widget. If present, this file will be included into any page
        that displays this widget and it's constructor and methods called.
        Further details of this object are described below.

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
        wide and rows 255px high.

    3. _`<name>.html`_

        A file containing an HTML fragment which, if present, will be
        included into any page that displays this widget as the initial
        widget content.

        _[This feature is of limited value, isn't used by any current
        widgets and may noy be supported by any currebt frameworks. iots
        use is depricated and it may be withdrawn from future versions
        of the framework]_

    4. _`<name>_schema.json`_

        A [JSON Schema](http://json-schema.org/) definition of the
        parameters needed to configure the widget. The
        SmartPanel Framework uses this to auto-generate web forms with
        these fields that allow the user to  configure the widget.

        Include a top-level "title" property in the json schema which
        will be used as the user readable version of the name of the
        widget. Individual parameters should include "title" and
        "description" elements which will be displayed to users.

    5. _`requirements.json`_

        A file listing additional additional JavaScript files and
        stylesheets that need to be loaded to make the widget work. If
        present, this file must contain an object with keys "scripts"
        and/or "stylesheets". Each of these must contain an array whose
        elements are either:

        * Objects containing keys "src" and "integrity" (for scripts) or
          "href" and "integrity" (for stylesheets) with apropriate
          values, for non local dependencies; or
        * local filenames

        An example of such a file appears below.

        A copy of jQuery will automatically be available and a request
        for this shouldn't appear in requirements.

    6. _`README.md`_

        An optional documentation file for the widget.

The widget directory may contain other files. These will be
web-accessible and can be referenced by other components by relative URLs
(from HTML and CSS files) or via the `static_url`
configuration parameter (for JavaScript files).

## Widget JavaScript objects

JavaScript objects defining widgets must have the flowing
characteristics:

* Named based on _`<name>`_ but in camel case without   any '\_'
  characters - for example `StationBoard`.

* A constructor to be invoked by `new`. This may be called
  before DOM construction is complete and so shouldn't
  reference any DOM objects. It will recieve two parameters:

    * A JavaScript Object conventionally named `params` containing
      static configuration parameters for the widgit:

        * container: The string DOM `id` of the page element
          into which the widget's content should be placed. This
          is guaranteed to be unique within any particular
          SmartScreen instance and so can be used as a base for
          other globally-unique names if needed. This page element
          will have a class of the widget's _`<name>`_ and the CSS
          attribute `position: relative`.

        * static_url: a URL coresponding to the widget directory (i.e.
          the one containing the JavaScript file). This allow
          the JavaScript to access other resources in the widget
          directory without having to hard-code URLs. Hard-coded URL's
          must not be used to allow SmartScreens to be setup
          under a variety of URL prefixes.

    * A JavaScript object conventionally named `config` containing
      parameters for a particular instance of the widget as defined
      in the _`<name>-schema.json`_ file.

* Optionally an `init()` method. If present, this will be
  called after DOM construction is complete and all widgets have
  been instantiated. It will normally
  arrange to populate the widget. This method may take
  responsibility for subsequently updating the widget's content, or
  this could be left to the `reload()` method.

* Optionally a `reload()` method. If present, this will be
  periodically called after the widget has been initialised and
  will typically arrange to update the widget's content.

Other than it's own name, widgets must not create any new names in
the JavaScript global context.

Widgets can assume that a copy of jQuery is available and must not
include this in their `requirements.json` file.

The page element identified by `container` will be in a class named
after the widget and will have the CSS attribute `position: relative`.

Widgets may assume the existance of a global `RTMONITOR_API` containing
an instance of the RT Monitor API.

Widgets may assume the existance of a global `DEBUG` which will contain
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
