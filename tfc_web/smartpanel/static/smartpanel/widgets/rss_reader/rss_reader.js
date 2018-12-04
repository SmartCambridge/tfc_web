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

    this.reload = function () {
        log('reload');
        do_load();
    };

    function do_load() {
        log('Running do_load()');

        log('Container', '#' + self.config.container_id);

        var qs = '?url='+encodeURIComponent(self.params.url);

        var uri = SMARTPANEL_RSS_PROXY + qs;

        log('do_load uri', uri);

        var xhr = new XMLHttpRequest();

        xhr.overrideMimeType('text/xml');

        // We will use the smartpanel RSS proxy, and pass the url as a querystring argument.
        var qs = '?title='+encodeURIComponent(self.params.title);
        qs += '&url='+encodeURIComponent(self.params.url);

        log('get_xml','getting', uri);

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

                log('do_load GET succeeded');
                var elem = document.createElement('textarea');
                // try and 'safely' decode string
                elem.innerHTML = xhr.responseText;
                var decoded_xml = elem.value;

                var xml_dom = (new window.DOMParser() ).parseFromString(decoded_xml, "text/xml");

                update_display(xml_dom);
            }
        };

        log('do_load done');
    };

    function update_display(xml_dom) {
        var container = document.getElementById(self.config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (container.firstChild) {
        container.removeChild(container.firstChild);
        }

        //var img = document.createElement('img');
        //img.setAttribute('src', self.config.static_url + 'black-bubble-speech.png');
        //img.setAttribute('alt', '');
        //title.appendChild(img);
        //
        if (self.params.title && self.params.title.text) {
            var title = document.createElement('div');
            title.className = 'rss_title';

            title.appendChild(document.createTextNode(self.params.title.text));
            if (self.params.title.style) {
                title.style = self.params.title.style;
            }
            container.appendChild(title);
        }

        // Quietly exit / do nothing if XML unavailable
        if (!xml_dom) {
            log('update_display','null parsed XML');
            return;
        }

        var item_tag = 'item';
        if (self.params.items && self.params.items.tag) {
            item_tag = self.params.items.tag;
        }
        log('update_display','item_tag',item_tag);

        // items_xml is the list of xml DOM elements representing the RSS items
        var items_xml = xml_dom.getElementsByTagName(item_tag);

        log('update_display',items_xml.length,'items');

        // items_el is the widget parent element that will contain the HTML items for display
        var items_el = document.createElement('div');
        items_el.className = 'rss_items';
        container.appendChild(items_el);

        print_items(items_el, items_xml);
    }

    // Display the list of RSS items in the widget
    function print_items(items_el, items_xml) {
        log('print_items',items_xml);

        // Convert to regular Array
        var items = Array.prototype.slice.call(items_xml, 0);

        // If the config includes a sort tag, then pre-sort the items on this tag
        if (self.params.items && self.params.items.sort ) {
            // Find the format of the sort tag from the item list (e.g. 'iso8601')
            var sort_format = null;
            for (var i=0; i<self.params.item.length; i++) {
                if (self.params.item[i].tag == self.params.items.sort) {
                    // sort tag found in params.item, so use format
                    sort_format = self.params.item[i].format;
                }
            }

            var sort_order = null;
            if (self.params.items && self.params.items.sort_order) {
                sort_order = self.params.items.sort_order;
            }

            log('print_items','sorting',self.params.items.sort, sort_format, sort_order);

            // sort_compare will return a sort function based on the tag name and format
            var sort_fn = sort_compare(self.params.items.sort, sort_format);

            // To implement ascending (for events) and descending (for news)
            // we'll either give sort_fn to Array.sort(), or create a
            // function that reverses sort_fn by swapping the arguments.
            if (sort_order == "ascending") {
                items.sort( sort_fn );
            } else {
                items.sort( function(a,b) { return sort_fn(b,a); } );
            }
        }

        // Print the sorted items
        for (var i = 0; i < items.length; i++) {
            print_item(items_el, items[i]);
        }
    }

    // return a function(a,b) that returns a > b as +1, otherwise -1
    function sort_compare(sort_tag, sort_format) {
        return function (item1, item2) {
            // Pick out the comparable values from the two items
            var values1 = item1.getElementsByTagName(sort_tag);
            if (values1.length == 0) {
                return -1;
            }
            var values2 = item2.getElementsByTagName(sort_tag);
            if (values2.length == 0) {
                return -1;
            }

            // Now do comparison
            //
            // Comparing dates?
            if (sort_format == 'rfc2282' || sort_format == 'iso8601') {
                var date1 = new Date(values1[0].textContent);
                var date2 = new Date(values2[0].textContent);
                if (date1 > date2) {
                    return +1;
                }
                return -1;
            }

            // Comparing any other formats
            if (values1[0].textContent > values2[0].textContent) {
                return +1;
            }
            return -1;
        }
    }

    function print_item(items_el, item_xml) {

        log('print_item',item_xml);

        var item_params = self.params.item;

        var item_el = document.createElement('div');

        for (var i=0; i<item_params.length; i++) {
            var element = item_element(item_xml, item_params[i]);
            if (element) {
                item_el.appendChild(element);
            }
        }

        items_el.appendChild(item_el);
    }

    // Write a piece (e.g. title, description) of the RSS item to the widget
    // Each 'element' has a 'label', e.g. 'title', 'description', 'date'
    // That 'label' is used in the params to provide configuration attributes, including
    // the 'tag' (e.g. 'ev:startdate')
    function item_element(item_xml, params) {

        log('item_element', item_xml, params);

        var div = document.createElement('div');
        var tag = params.tag;
        var tag_format = 'text';
        // slice_function(from, to, append)
        var slice_fn = slice_function(null,null,null); // defaults to identity

        if (params.style) {
            div.style = params.style;
        }
        if (params.format) {
            tag_format = params.format;
        }
        // create a slice function from params as tag_value.slice(from, to)
        if (params.slice) {
            slice_fn = slice_function(params.slice.from, params.slice.to, params.slice.append);
        }

        var xml_values = item_xml.getElementsByTagName(tag);
        if (xml_values.length > 0) {
            var xml_value = xml_values[0].textContent;
            var html;
            switch (tag_format) {

            // If item element format is 'html' then pass to widget 'as-is' and cannot slice (would break markup)
                case 'html':
                    try {
                        html = decodeURIComponent(xml_value);
                    } catch (err) {
                        // decodeURI aborts with an exception for any %... value not a proper encode string
                        // But e.g. our content might contain a single '%', so fall back to using unescape.
                       html = unescape(xml_value);
                    }
                    div.innerHTML = safe(html);
                    break;

                case 'html_to_text':
                    log('item_element','html_to_text',tag,xml_value);
                    // For html_to_text, parse as above but strip ALL html tags (and then can slice)
                    try {
                        html = decodeURIComponent(xml_value);
                    } catch (err) {
                        // decodeURI aborts with an exception for any %... value not a proper encode string
                        // But e.g. our content might contain a single '%', so fall back to using unescape.
                       html = unescape(xml_value);
                    }

                    log('item_element','tag_value',xml_value);

                    var text = html_to_text(html);

                    log('item_element','text',text);
                    var node_text = slice_fn(text);
                    log('item_element','node_text',node_text);
                    div.appendChild(document.createTextNode(node_text));
                    break;

                case 'rfc2282':
                    log('item_element','rfc2282',tag,xml_value);
                    div.appendChild(document.createTextNode(date_rfc2282(xml_value,false)));
                    break;

                case 'iso8601':
                    log('item_element','iso8601',tag,xml_value);
                    var js_date = new Date(xml_value);
                    div.appendChild(document.createTextNode(date_iso8601(xml_value,false)));
                    break;

                case 'rfc2282_today':
                    log('item_element','rfc2282',tag,xml_value);
                    div.appendChild(document.createTextNode(date_rfc2282(xml_value,true)));
                    break;

                case 'iso8601_today':
                    log('item_element','iso8601',tag,xml_value);
                    var js_date = new Date(xml_value);
                    div.appendChild(document.createTextNode(date_iso8601(xml_value,true)));
                    break;

                default: // default tag_format value is 'text'
                    // embed tag string value in div, after applying slice
                    div.appendChild(document.createTextNode(slice_fn(xml_value)));
                    break;
            }

            return div;
        }

        return null;
    }

    function date_rfc2282(xml_value) {
        return date_iso8601(xml_value);
    }

    function date_iso8601(xml_value, today) {
        var d = new Date(xml_value);
        var hours = d.getHours();
        var mins = d.getMinutes()
        var month = '' + (d.getMonth() + 1);
        var day = '' + d.getDate();
        var year = d.getFullYear();
        var day_of_week = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        var am_pm = 'pm';
        if (hours < 12) {
            am_pm = 'am';
        }
        if (hours >= 13) {
            hours = hours - 12;
        }

        var time = '12noon';
        if (hours != 12 || mins != 0) {
            time = hours + ':' + ('0'+mins).slice(-2) + am_pm;
        }

        var return_str = null;
        if (today && same_day(new Date(),d)) {
            return_str = time + ' TODAY';
        } else {
            return_str = day_of_week + ' ' + day + ' ' + mon + ' ' + time;
        }
        log('date_iso8601',d,return_str);
        return return_str;
    }

    function same_day(d1, d2) {
          return d1.getFullYear() === d2.getFullYear() &&
                 d1.getMonth() === d2.getMonth() &&
                 d1.getDate() === d2.getDate();
    }

    // Return a function that trims a string using JS 'slice(from, to)'
    // If the new string is shortened, and append string is given then append that.
    // E.g. var slice_fn = slice_function(0,10,'...'); slice_fn("abcdefghijklmn") -> "abcdefghij..."
    function slice_function(param_from, param_to, param_append) {
        log('slice_function',param_from,param_to,param_append);
        var slice_fn = function (x) { return x; }; // no slice by default
        var from = 0;
        var append_str = '';
        if (param_from === 0 || param_from) {
            from = param_from;
            if (param_to) {
                if (param_append) {
                    append_str = param_append;
                }
                slice_fn = function (x) { var newx = x.slice(from, param_to);
                                          if ( param_to < x.length ) {
                                              newx += append_str;
                                          }
                                          return newx;
                }
            } else {
                log('slice_function','no param_to so remove first',from,'chars');
                slice_fn = function (x) { return x.slice(from); };
            }
        }
        return slice_fn;
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

    function html_to_text(html) {
        var html_no_tags = sanitizeHtml(html, { allowedTags: [] });

        var parser = new DOMParser;
        var dom = parser.parseFromString('<!doctype html><body>' + html_no_tags, 'text/html');
        return dom.body.textContent;
    }

    function log() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('rss_reader_log') >= 0) {
            var args = Array.prototype.slice.call(arguments); // Make real array from arguments
            args.unshift('RssReader '+self.widget_id);
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
    //
    // Default widget params for NEWS and EVENTS style RSS
    //   News items are sorted on a field 'pubDate'
    //   Events items can have another datetime in 'ev:startdate'
    //
    var DEFAULT_PARAMS = {};
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
                                           style: 'color: blue; font-weight: bold',
                                           format: 'html_to_text'
                                         },
                                         { tag: 'ev:location' },
                                         { tag: 'description',
                                           style: 'margin-left: 20px; font-size: 0.8em; font-style: italic',
                                           slice: { from: 0, to: 200, append: '...' },
                                           format: 'html_to_text'
                                         },
                                         { tag: 'pubDate',
                                           style: 'margin-left: 20px; margin-bottom: 10px; color: #222222; font-weight: normal; font-size: 0.8em; font-style: italic',
                                           format: 'rfc2282'
                                         }
                                       ]
    };

    DEFAULT_PARAMS['events'] = {   title: { text: 'CL Talks',
                                            style: 'font-weight: bold; font-size: 1.5em'
                                          },
                                   url:   'https://talks.cam.ac.uk/show/rss/6330',
                                   feed_type: 'events',
                                   items: { tag: 'item',
                                            sort: 'ev:startdate',
                                            sort_order: 'ascending'
                                          },
                                   item:  [
                                            { tag: 'ev:startdate',
                                              style: 'color: green; font-weight: bold',
                                              format: 'iso8601'
                                            },
                                            { tag: 'title',
                                              style: 'color: #990000; font-weight: normal',
                                              // For talks.cam to remove date from title... slice: { from: 17 },
                                              format: 'html_to_text'
                                            },
                                            { tag: 'ev:location' },
                                            { tag: 'description',
                                              style: 'margin-left: 20px; margin-bottom: 10px; font-size: 0.8em; font-style: italic',
                                              slice: { from: 0, to: 200, append: '...' },
                                              format: 'html_to_text'
                                            }
                                          ]
    };

    // params.feed_type is 'news'|'events'|'custom'
    // and params.feed_type = 'custom' will reveal the custom format paramters on the config div
    var feed_type = 'news';

    var widget_config;

    this.configure = function (config, params) {

        if (!params || JSON.stringify(params) == "{}") {
            log('configure','empty params');
            params = DEFAULT_PARAMS['news'];
        }

        log('configure','feed_type',params.feed_type);

        feed_type = params.feed_type;

        widget_config = new WidgetConfig(config);

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

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = "This widget displays an RSS feed.";
        config_info_text += " 'Main Title' is any text to appear in bold at the top of the feed list.";
        config_info1.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info1);

        var config_table = document.createElement('table');
        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);
        var config_tbody = document.createElement('tbody');
        config_table.appendChild(config_tbody);

        // TITLE
        //
        var title_text_result = widget_config.input( config_tbody,
                                        'string',
                                        { text: 'Main Title:',
                                          title: 'The main title at the top of the widget, e.g. RSS feed name'
                                        },
                                        params.title ? params.title.text : PARAMS_NEWS.title.text);
        // url
        //
        var url_result = widget_config.input( config_tbody,
                                        'string',
                                        { text: 'RSS feed url:',
                                          title: 'Include full url, including http/https://',
                                          size: 50
                                        },
                                        params.url);

        var custom_result; // will hold { valid:, value: } from input_rss_custom()

        // Create row on table to hold custom configuration params which we can hide/unhide
        var custom_tr = document.createElement('tr');
        var custom_div = document.createElement('div');

        var click_fn = function (value) {
            log('click_fn', value);
            switch (value) {
                case 'custom':
                    log('Custom');
                    feed_type = 'custom';
                    custom_tr.style.display = null;
                    break;

                case 'news':
                    log('News');
                    feed_type = 'news';
                    custom_result = input_rss_custom(custom_div, DEFAULT_PARAMS['news']);
                    break;

                case 'events':
                    log('Events');
                    feed_type = 'events';
                    custom_result = input_rss_custom(custom_div, DEFAULT_PARAMS['events']);
                    break;

                default:
                    break;
            }
        };

        // Add News / Events / Custom radiobuttons
        input_rss_choice(config_tbody, params.feed_type, click_fn);

        if (feed_type != 'custom') {
            custom_tr.style.display = 'none'; // Custom config input is initially hidden unless 'custom'
        }
        config_tbody.appendChild(custom_tr);
        var td = document.createElement('td');
        td.className = 'widget_config_property_name';
        custom_tr.appendChild(td);
        var label = document.createElement('label');
        td.appendChild(label);
        label.title = 'Custom configuration parameters for your RSS feed';
        label.innerHTML = 'Custom config:';
        td = document.createElement('td');
        td.className = 'widget_config_property_value';
        custom_tr.appendChild(td);

        td.appendChild(custom_div);

        custom_result = input_rss_custom(custom_div, params);

        // currently the only validity check is on the JSON format of the "item" custom params
        var valid_fn = function () {
            var is_valid = custom_result.valid();
            return is_valid;
        }

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};

            var custom_params = custom_result.value();
            // location
            config_params.title = { text: title_text_result.value(),
                                    style: custom_params.title.style
                                  };

            config_params.url = url_result.value();

            config_params.feed_type = feed_type;

            config_params.items = custom_params.items;

            config_params.item = custom_params.item;

            log('input_rss_reader','returning params:',config_params);

            return config_params;
        };

        // Return the 'Layout title' for this configured widget
        // Returned in an object such as { title: 'RSS: Computer Lab Talks' }
        // In future we might add additional properties
        var config_fn = function () {
            var title_text = title_text_result.value();

            return { title: 'RSS: ' + (title_text ? title_text : 'no title') };
        };

        return { valid: valid_fn,
                 config: config_fn,
                 value: value_fn };

    }// end input_rss_reader()

    // Add row to table with RSS Type radio buttons
    function input_rss_choice(parent_el, feed_type, click_fn) {
        // <tr><td><label>Feed type:</label></td>
        //     <td><input type="radio" name="rss_type" value="news"/>News<br/>...</td>
        // </tr>
        var tr = document.createElement('tr');
        parent_el.appendChild(tr);
        var td = document.createElement('td');
        td.className = 'widget_config_property_name';
        tr.appendChild(td);
        var label = document.createElement('label');
        td.appendChild(label);
        label.title = 'RSS feed type. Default (news) sorts on pubDate. Events sorts on ev:startdate';
        label.innerHTML = 'Feed type:';
        td = document.createElement('td');
        td.className = 'widget_config_property_value';
        tr.appendChild(td);
        add_radio_button(td, 'rss_type', 'news',   'News',   feed_type, click_fn);
        add_radio_button(td, 'rss_type', 'events', 'Events', feed_type, click_fn);
        add_radio_button(td, 'rss_type', 'custom', 'Custom', feed_type, click_fn);
    }

    // The 'custom' parameters are implemented in their own function so that
    // it can be called multiple times as user clicks the news/events/custom radio buttons
    function input_rss_custom(custom_div, params) {

        // clear out any existing content
        while (custom_div.firstChild) {
                custom_div.removeChild(custom_div.firstChild);
        }

        // "title" "style"
        var title_style_result = widget_config.input( custom_div,
                                        'string',
                                        { text: 'Title style:',
                                          title: 'The CSS style properties to apply to the main RSS feed title'
                                        },
                                        params.title ? params.title.style : DEFAULT_PARAMS[feed_type].title.style);
        // "items" "tag"
        var items_tag_result = widget_config.input( custom_div,
                                        'string',
                                        { text: 'Items tag:',
                                          title: 'The RSS XML tag that contains the items, usually "items"'
                                        },
                                        params.items ? params.items.tag : DEFAULT_PARAMS[feed_type].items.tag);
        // "items" "sort"
        var items_sort_result = widget_config.input( custom_div,
                                        'string',
                                        { text: 'Item sort tag:',
                                          title: 'The RSS XML tag that contains the item property to sort on, usually "pubDate"'
                                        },
                                        params.items ? params.items.sort : DEFAULT_PARAMS[feed_type].items.sort);
        // "items" "sort_order"
        var items_sort_order_result = widget_config.input( custom_div,
                                        'select',
                                        { text: 'Item sort order:',
                                          title: 'e.g. ascending for dates means earliest at top of list (useful for events)',
                                          options: [ { value: 'descending', text: 'Descending' },
                                                     { value: 'ascending', text: 'Ascending' }
                                                   ]
                                        },
                                        params.items ? params.items.sort_order : DEFAULT_PARAMS[feed_type].items.sort_order);
        // "item" textarea JSON input
        var item_result = widget_config.input( custom_div,
                                          'string',
                                          { text: 'Item format:',
                                            title: 'Input your item format definition',
                                            format: 'textarea'
                                          },
                                          // pretty-print JSON into input textarea
                                          params.item ? JSON.stringify(params.item,null,2) : JSON.stringify(DEFAULT_PARAMS[feed_type].item,null,2));

        var value_fn = function () {
            var params = { title: { style: title_style_result.value() },
                           items: { tag: items_tag_result.value(),
                                    sort: items_sort_result.value(),
                                    sort_order: items_sort_order_result.value()
                                  },
                           item: JSON.parse(item_result.value())
                         };
            return params;
        }

        var valid_fn = function () {
            try {
                JSON.parse(item_result.value());
            }
            catch (e) {
                log('input_rss_custom','valid_fn','item format JSON error');
                item_result.element.style['background-color'] = '#ff8888';
                return false;
            }
            log('input_rss_custom','valid_fn','item JSON format OK');
            return true;
        }

        return { value: value_fn,
                 valid: valid_fn
        };
    }// end input_rss_custom()

    // Add a radio button to the parent element, checked if name == name_selected
    function add_radio_button(parent_el, name, value, text, value_selected, click_fn) {
        var label = document.createElement('label');
        parent_el.appendChild(label);
        var input = document.createElement('input');
        input.style['vertical-align'] = 'middle';
        input.onclick = function () { return click_fn(value);};
        label.appendChild(input);
        input.type = 'radio';
        input.name = name;
        input.value = value;
        if (value == value_selected) {
            input.checked = 'checked';
        }
        label.appendChild(document.createTextNode(text));
        parent_el.appendChild(document.createElement('br'));
    }

    function rss_custom_id() {
            return 'rss_custom_id_'+widget_id;
    }

    log('Instantiated RSSReader');

} // End of 'class' RSSReader
