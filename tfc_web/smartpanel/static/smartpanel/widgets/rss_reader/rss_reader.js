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

        // items_xml is the list of xml DOM elements representing the RSS items
        var items_xml = xml_dom.getElementsByTagName('item');

        log('update_display',items_xml.length,'items');

        // items_el is the widget parent element that will contain the HTML items for display
        var items_el = document.createElement('div');
        items_el.class = 'rss_list';
        container.appendChild(items_el);

        print_items(items_el, items_xml);
        //rss_list.innerHTML = safe(rss_xml);
    }

    function print_items(items_el, items_xml) {

        log('print_items',items_xml);
        for (var i = 0; i < items_xml.length; i++) {
            print_item(items_el, items_xml[i]);
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
                    var parser = new DOMParser;
                    var dom = parser.parseFromString('<!doctype html><body>' + xml_value, 'text/html');
                    xml_value = dom.body.textContent;
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
                    div.appendChild(document.createTextNode(date_rfc2282(xml_value)));
                    break;

                case 'iso8601':
                    log('item_element','iso8601',tag,xml_value);
                    var js_date = new Date(xml_value);
                    div.appendChild(document.createTextNode(date_iso8601(xml_value)));
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

    function date_iso8601(xml_value) {
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
        if (hours != 12 && mins != 0) {
            time = hours + ':' + ('0'+mins).slice(-2) + am_pm;
        }

        var return_str = null;
        if (same_day(new Date(),d)) {
            return_str = time + ' ' + day_of_week+' '+day+' '+mon;
        } else {
            return_str = day_of_week + ' ' + day + ' ' + mon + ' ' + time;
        }
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
        return sanitizeHtml(html, { allowedTags: [] });
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

    log('Instantiated RSSReader');

} // End of 'class' RSSReader
