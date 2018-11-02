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
function RssReader(widget_id) {

    'use strict';

    //var DEBUG = ' rss_reader_log';

    var self = this;

    var SMARTPANEL_RSS_PROXY = '/smartpanel/rss_reader';

    self.widget_id = widget_id;

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        this.do_load();
    };

    this.do_load = function () {
        log(self.widget_id, 'Running do_load()');

        log('Container', '#' + self.config.container_id);

        var qs = '?url='+encodeURIComponent(self.params.url);

        var uri = SMARTPANEL_RSS_PROXY + qs;

        log(self.widget_id, 'do_load uri', uri);


        log(' - fetching', uri);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.send();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === XMLHttpRequest.DONE) {
                //var api_result = JSON.parse(xhr.responseText);
                //
                if (xhr.status !== 200) {
                    log('do_load XMLHttpRequest error, status', xhr.status);
                    return;
                }

                var rss_xml = xhr.responseText;

                update_display(rss_xml);
            }
        };

        log(self.widget_id,'do_load done');
    };

    function update_display(rss_xml) {
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

        var rss_list = document.createElement('div');
        rss_list.innerHTML = safe(rss_xml);
        container.appendChild(rss_list);
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
            args.unshift(self.name);
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
