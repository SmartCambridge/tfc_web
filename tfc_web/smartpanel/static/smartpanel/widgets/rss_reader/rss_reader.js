/* RSSReader Widget for SmartPanel */

/* global $, DEBUG */
/* exported RSSReader */

// SmartPanel template will instantiate an RSSReader, giving it a unique (for this panel) widget_id
// Note the widget does NOT load / write its content onto the panel at this stage.

// Subsequently, the template will call RSSReader.display(config, params) at which point the widget
// should render onto the DOM object given in the 'config'.
//
// In summary, the 'config' gives the SmartPanel info of where the widget is supposed to render, and
// 'params' gives the details for this particular widget (in this case the URL of the RSS feed, etc)
//
// The widget also provides a RSSReader.configure(config, params) method, which can be called by the
// smartpanel *layout* such that this widget code prompts for its 'params' configuration values. In
// this way each widget contains both its rendering and configuration code, so it is largely self
// contained and that simplifies the SmartPanel layout code.
//
// All parameters:
//
// var rss_reader = new RssReader(widget_id) // widget_id = unique string on *this* layout.
// e.g. rss_reader = new RssReader('77');
//
// rss_reader.display(config, params) // config = { container_id: <DOM id of a DIV on the page> }
//                                       params = { title: <heading title of this widget>,
//                                                  url: <http/https URL of an RSS xml feed>
//                                                }
// e.g. rss_reader.display( { container_id: 'widget_5' },
//                          { title: 'CL talks',
//                            url: 'https://talks.cam.ac.uk/show/index/6330' }
//                        )
//
function RssReader(widget_id) {

    'use strict';

    var DEBUG = ' rss_reader_log';

    var self = this;

    var SMARTPANEL_RSS_PROXY = '/smartpanel/rss_reader';

    self.widget_id = widget_id;

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        do_load();
    };

    function do_load() {
        log(self.widget_id, 'Running do_load()');

        log('Container', '#' + self.config.container_id);

        var qs = '?url='+encodeURIComponent(self.params.url);

        var uri = SMARTPANEL_RSS_PROXY + qs;

        log(self.widget_id, 'do_load uri', uri);


        log(' - fetching', uri);

        var xhr = new XMLHttpRequest();

        xhr.overrideMimeType('text/xml');

        // We will use the smartpanel RSS proxy, and pass the url as a querystring argument.
        var qs = '?title='+encodeURIComponent(self.params.title);
        qs += '&url='+encodeURIComponent(self.params.url);

        console.log('get_xml','getting', uri);

        xhr.open('GET', uri);

        xhr.send();

        xhr.onreadystatechange = function() {
            if(xhr.readyState === XMLHttpRequest.DONE) {
                //var api_result = JSON.parse(xhr.responseText);
                //
                if (xhr.status !== 200) {
                    log('do_load XMLHttpRequest error, status', xhr.status);
                    return;
                }

                var elem = document.createElement('textarea');
                // try and 'safely' decode string
                elem.innerHTML = xhr.responseText;
                var decoded_xml = elem.value;

                var xml_dom = (new window.DOMParser() ).parseFromString(decoded_xml, "text/xml");

                update_display(xml_dom);
            }
        };

        log(self.widget_id,'do_load done');
    };

    function update_display(xml_dom) {
        var container = document.getElementById(self.config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (container.firstChild) {
        container.removeChild(container.firstChild);
        }

        var title = document.createElement('h1');
        //var img = document.createElement('img');
        //img.setAttribute('src', self.config.static_url + 'black-bubble-speech.png');
        //img.setAttribute('alt', '');
        //title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode(self.params.title));
        container.appendChild(title);

        // Quietly exit / do nothing if XML unavailable
        if (!xml_dom) {
            console.log('handle_xml','null parsed XML');
            return;
        }

        var items = xml_dom.getElementsByTagName('item');

        console.log('handle_xml','with',items.length,'items');

        var page_items = document.createElement('ul');
        page_items.class = 'rss_list';
        container.appendChild(page_items);

        print_items(page_items, items);
        //rss_list.innerHTML = safe(rss_xml);
    }

    function print_items(page_items, items) {

        for (var i = 0; i < items.length; i++) {
            var titles = items[i].getElementsByTagName('title');
            var title = titles[0];
            console.log( 'loaded', title ) ;

            print_item(page_items, items[i]);
        }
    }

    function print_item(items, item) {
        var li = document.createElement('li');

        var title_el = item_element(item, 'title');
        if (title_el) {
            li.appendChild(title_el);
        }

        var description_div = document.createElement('div');
        var descriptions = item.getElementsByTagName('description');
        if (!descriptions) {
            console.log('print_item','no descriptions');
        }

        if (!descriptions[0]) {
            console.log('print_item','no descriptions[0]');
        }

        var description = null;
        try {
            description = decodeURIComponent(descriptions[0].textContent);
        } catch (err) {
            // decodeURI aborts with an exception for any %... value not a proper encode string
            // But our descriptions might contain a single '%', so fall back to using unescape.
            console.log('print_item','description error');
            description = unescape(descriptions[0].textContent);
        }

        description_div.innerHTML = safe(description);

        var start_date_div = document.createElement('div');
        var start_dates = item.getElementsByTagName('ev:startdate');
        var start_date = start_dates[0].textContent;
        start_date_div.appendChild(document.createTextNode(start_date));

        var location_div = document.createElement('div');
        var locations = item.getElementsByTagName('ev:location');
        var location = locations[0].textContent;
        location_div.appendChild(document.createTextNode(location));

        items.appendChild(li);
        li.appendChild(start_date_div);
        li.appendChild(location_div);
        li.appendChild(description_div);
    }

    function item_element(item, label) {
        var div = document.createElement('div');
        var tag = label;
        var slice_fn = function (x) { return x; }; // no slice by default
        if (self.params.item && self.params.item[label]) {
            var param = self.params.item[label];
            if (param.style) {
                div.style = param.style;
            }
            if (param.tag) {
                tag = param.tag;
            }
            // create a slice function from params as tag_value.slice(from, to)
            if (param.slice) {
                var from = 0;
                var append_str = '';
                if (param.slice.from) {
                    from = param.slice.from;
                    if (param.slice.to) {
                        if (param.slice.append) {
                            append_str = param.slice.append;
                        }
                        slice_fn = function (x) { var newx = x.slice(from, param.slice.to);
                                                  if ( param.slice.to < x.length ) {
                                                      newx += append_str;
                                                  }
                                                  return newx;
                        }
                    } else {
                        slice_fn = function (x) { return x.slice(from); };
                    }
                }
            }
        }

        var tag_values = item.getElementsByTagName(tag);
        if (tag_values.length > 0) {
            var tag_value = tag_values[0].textContent;
            // embed tag string value in div, after applying slice
            div.appendChild(document.createTextNode(slice_fn(tag_value)));
            return div;
        }

        return null;
    }

    // remove unwanted html tags from a string
    function safe(dirty) {
        return sanitizeHtml(dirty, {
            allowedTags: [ 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong',
                'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead',
                'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img'],
            allowedAttributes: {
                'a': [ 'href' ],
                'img': [ 'src' ],
            }
        });
    }

    function log() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('rss_reader_log') >= 0) {
            console.log.apply(console, arguments);
            var args = Array.prototype.slice.call(arguments); // Make real array from arguments
            args.unshift('RssReader');
            console.log.apply(console, args);
        }
    };

    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    //
    // config:
    //      container_id
    //      static_url
    //      height
    //      width
    //      settings:
    //          SMARTPANEL_TRANSPORT_API
    //
    // params:
    //      ( as needed by the active widget )
    //
    // returns
    //  {   valid: function () -> true,
    //      value: function () -> params as provided by user,
    //      config: function () -> { title: suitable title for config layout }
    //  }
    //
    this.configure = function (config, params) {

        var widget_config = new WidgetConfig(config);

        var config_div = document.getElementById(config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
                config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var config_title = document.createElement('h1');
        config_title.innerHTML = 'Configure RSS Reader';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');

        var input_result = input_rss_reader(widget_config, config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the params
    function input_rss_reader(widget_config, parent_el, params) {

        var config_table = document.createElement('table');
        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);
        var config_tbody = document.createElement('tbody');
        config_table.appendChild(config_tbody);

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = "This widget displays an RSS feed.";
        config_info_text += " 'Main Title' is any text to appear in bold at the top of the feed list.";
        config_info1.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info1);

        // TITLE
        //
        var title_result = widget_config.input( config_tbody,
                                        'string',
                                        { text: 'Main Title:',
                                          title: 'The main title at the top of the widget, e.g. RSS feed name'
                                        },
                                        params.title);
        // url
        //
        var url_result = widget_config.input( config_tbody,
                                        'string',
                                        { text: 'RSS feed url:',
                                            title: 'Include full url, including http/https://'
                                        },
                                        params.url);



        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // location
            config_params.title = title_result.value();

            config_params.url = url_result.value();

            log(self.widget_id,'returning params:',config_params);

            return config_params;
        };

        // Return the 'Layout title' for this configured widget
        // Returned in an object such as { title: 'RSS: Computer Lab Talks' }
        // In future we might add additional properties
        var config_fn = function () {
            return { title: 'RSS: '+title_result.value() };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    }// end input_rss_reader()

    log(self.widget_id, 'Instantiated RSSReader');

} // End of 'class' RSSReader
