# RSS Reader SmartPanel Widget

Formats and displays an RSS feed retrieved from a web URL

**NOTE:** this README refers to the Javascript configuration parameters as required by the RssReader
widget. The user input of these parameters on the SmartPanel layout design page will necessarily be
in **JSON format**.

There are TWO parts to this SmartPanel RSS reader:

1. tfc_web provides a web PROXY to retrieve the RSS XML, so the browser displaying the SmartPanel
   permits what would otherwise be a cross-site http request.

2. The SmartPanel software provides this RssReader widget which uses the proxy to get the required
   RSS xml and format it for display within the SmartPanel.  The widget also provides the configuration
   code necessary to set the parameters for the widget during the layout design process.

## The SmartPanel RSS proxy

tfc_web provides a page that can be given the desired RSS url and will retrieve and return the data
to the reqesting SmartPanel rss_reader widget, e.g. the Department of Computer Science new feed is at
```
https://www.cst.cam.ac.uk/news/feed
```
and can be requested by the SmartPanel via
```
https://smartcambridge.org/smartpanel/rss_reader?url=https://www.cst.cam.ac.uk/news/feed
```
The proxy is provided because a server can dynamically retrieve any web page, but most browsers only
allow dynamic loading of content from the same website that loaded the original page.

This proxy will also _cache_ the retrieved RSS content so that multiple requests for the same content (e.g.
from multiple SmartPanels) will not result in multiple requests to the original source.

## The RssReader widget

### Simplest configuration

At its simplest, the RssReader widget can be configured with

* `title`. E.g. 'Computer Lab News'

* `url`. E.g. 'https://www.cst.cam.ac.uk/news/feed'

The Feed type can be left to 'News' and the widget will provide a reasonable default display to the
RSS items ordered by publication date, with each item displayed as:

* its 'title' in bold, 

* the 'description' text indented slightly, stripped of html markup, and truncated to 200 chars

* the publication date ('pubDate') of the item

### 'News' vs 'Events'

#### News

Note that the RSS format (in XML) is essentially designed to display news items as 'latest first', using
an `<rss>` XML envelope containing multiple `<item>` sections, each of which contains a news item. 
Each `<item>` is structured to provide sub-elements, particularly
`<title>`, `<description>` and `<pubDate>`. 

```
<rss>
  <item>
    <title>Cambridge wins boat race</title>
    <description>Victory on the Thames for the light blues, while Oxford put up a strong fight.</description>
    <pubDate>Wed, 10 Oct 2018 13:08:27 +0000</pubDate>
  </item>
  <item>
    ... similar content of next item, etc
  </item>
  ...
</rss>
```
To view the content of a real news feed, visit [CL News](https://www.cst.cam.ac.uk/news/feed).

#### Events

Summary: a standard rss `<item>` with a `<pubDate>` is ok for news, but doesn't have anywhere to put additional key fields
such as a date/time an event is scheduled for (so we support `<ev:startdate>`) or a location (so 'ev:location').

Unfortunately, the general RSS feed format isn't sufficient if what you want to publish is a feed containing
'events' (such as meetings or talks) which require explicit support for the date and location of each event. The 
default RSS format would require you to bury the date and location information within the 'description' of the news
item so there would be no reliable way to display the meetings in order of date or location. Note that 'pubDate' is
the datestamp of when the author wrote the item and has nothing to do with the item content.

As an example, see how we display the [Computer Science talks at Cambridge](https://talks.cam.ac.uk/show/index/6330).

That information is also provided as [an XML RSS feed](https://talks.cam.ac.uk/show/rss/6330).

So the natural thing has occurred, and 'extensions' to the RSS format have emerged that allow you to stuff additional
_formatted_ data into each RSS item, but general support for these extensions is rare.

In particular for 'events' there is [this suggested standard](http://web.resource.org/rss/1.0/modules/event/), and
the _default_ support for 'Event' items in the RssReader supports these additional item properties:

* `<ev:startdate>`

* `<ev:location>`

## Custom configuration

Here is where the magic happens.

Actually _all_ configurations of the RssReader widget are effectively with 'custom' configuration parameters. Selecting
the 'News' or 'Events' defaults simply loads pre-designed parameter sets suitable for those types of feed content. The
default parameters are provided at the end of this README.

We'll review the configuration parameters in two parts: firstly for the feed in general, and then specifically how each
item should be rendered.

The general feed configuration parameters are:

* `title` (the title to appear at the top of the feed display)

* `url` (the web address to get the feed from)

* `feed_type` (whether this uses the default `news` or `events` format, or is fully `custom`)

* `items` (which rss element contains each news or event item, defaults to `item`)

In addition, for the format of each news or event item, we have:

* `item` (see section below)

### `title`

Object controlling display of the main title of the widget, containing:

* `text` - the intended heading for the widget, e.g. "CL News".

* `style` - CSS attributes for this main title, e.g. "font-weight: bold; color: green"

### `url`

String containing the URL of the required RSS feed, e.g. "https://www.cst.cam.ac.uk/news/feed"

The widget will periodically retrieve data from this URL (via the RSS proxy, see above).

### `feed_type`

String containing `news` or `events` or `custom`.

This doesn't directly affect the widget display, but is used during configuration to load
different configuration 'presets'.

### `items`

`items` is an object containing:

* `tag` - String, defaulting to `item`, i.e. the XML tag containing each RSS item

* `sort` - String, containing the item property on which items should be sorted, defaults
  to `pubDate` for news items and `ev:startdate` for events.

* `sort_order` - String, `ascending` or `descending`

### `item`

The `item` configuration parameter is the most complex, and determines which properties (such as
`title`) are picked out of each RSS item element, and how they're displayed.

The `item` configuration parameter is a list of `tag objects` where each `tag object` defines a single
sub-element within the RSS item and how it is to be displayed.

Hence each `tag object` is an object containing:

* `tag` - a string containing the XML tag (within the item) of interest, e.g. `title`.

* `style` - a string containing CSS properties to be used for this sub-element, e.g. "color: red"

* `slice` - an object containing parameters for the javascript 'slice' function to apply to the value
of this sub-item. This configuration parameter is generally useful, e.g. can be used to skip leading characters in
the sub-element (`slice: { from: 17 }`), and/or truncate the value to a maximum length (`slice: { from: 0, to: 200 }`).
Note that the javascript `slice` function allows negative indices which can be used to remove data from the end of the
string. The `slice` object contains the following properties:
    * `from` - an integer index into the value of this sub-item
    * `to` - (optional) an integer index into the value of this sub-item
    * `append` - (optional) a string to append to the final value of the sub-item if it is shortened as a result of the 'slice'.

* `format` - a string containing one of
    * `html_to_text` - strips all html tags out of the sub-element, resulting in a plain text string.
    * `iso8601` - (e.g. event feed ev.startdate) assumes the field is an ISO 8601 date time field.
    * `rfc2282` - (e.g. news feed pubDate) assumes the field is an RFC 2282 date time field.
    * `iso8601_today` - as `iso8601` except today's date will be replaced with the word 'TODAY' (useful for events)
    * `rfc2282_today` - as above but for rfc2282.
    * `html` - accepts a safe subset of the html markup in the element value
    * `text` - accepts the source value unchanged

For examples of the use of these configuration parameters see the news or events defaults below.

## Talks.cam

As this widget has been developed at Cambridge University, it includes direct support for the RSS feeds provided by
our awesome 'talks' communication platform, [talks.cam](https://talks.cam.ac.uk).

E.g. the Computer Science talks are collected on [this web page](https://talks.cam.ac.uk/show/index/6330) and can be
retrieved as a [RSS feed here](https://talks.cam.ac.uk/show/rss/6330).

Note the *only* difference from the default 'events' configuration and the specific configuration required for talks.cam
is an `item.slice` property to chop off the first 17 characters of the event item `title`. The talks.cam RSS feed has
the event start time embedded in the title (e.g. `<title>Tue 22 Jan 14:00: Evil on the Internet </title>`). I.e. 
as below for `DEFAULT_PARAMS['events']` plus
```
...
item: {
    ...
    slice: { from: 17 },
}
```
## Default configuration parameters

```

    DEFAULT_PARAMS['news'] = {  title: { text: 'CL News',
                                         style: 'font-weight: bold; font-size: 1.5em'
                                       },
                                url: 'https://www.cst.cam.ac.uk/news/feed',
                                feed_type: 'news',
                                items: { tag: 'item',
                                         sort: 'pubDate',
                                         sort_order: 'descending'
                                       },
                                item:  [
                                         { tag: 'title',
                                           style: 'color: blue; font-weight: normal;',
                                           format: 'html_to_text'
                                         },
                                         { tag: 'ev:location' },
                                         { tag: 'description',
                                           style: 'margin-left: 20px; font-size: 0.8em; font-style: italic;',
                                           slice: { from: 0, to: 200, append: '...' },
                                           format: 'html_to_text'
                                         },
                                         { tag: 'pubDate',
                                           style: 'margin-left: 20px; margin-bottom: 10px; color: green; font-weight: normal; font-size: 0.8em; font-style: italic;',
                                           format: 'rfc2282'
                                         }
                                       ]
    };

    DEFAULT_PARAMS['events'] = {   title: { text: 'CL Talks',
                                            style: 'font-weight: bold; font-size: 1.5em;'
                                          },
                                   url:   'https://talks.cam.ac.uk/show/rss/6330',
                                   feed_type: 'events',
                                   items: { tag: 'item',
                                            sort: 'ev:startdate',
                                            sort_order: 'ascending'
                                          },
                                   item:  [
                                            { tag: 'ev:startdate',
                                              style: 'color: green; font-weight: normal;',
                                              format: 'iso8601_today'
                                            },
                                            { tag: 'title',
                                              style: 'color: #990000; font-weight: normal;',
                                              // For talks.cam to remove date from title... slice: { from: 17 },
                                              format: 'html_to_text'
                                            },
                                            { tag: 'ev:location' },
                                            { tag: 'description',
                                              style: 'margin-left: 20px; margin-bottom: 10px; font-size: 0.8em; font-style: italic;',
                                              slice: { from: 0, to: 200, append: '...' },
                                              format: 'html_to_text'
                                            }
                                          ]
    };
```

