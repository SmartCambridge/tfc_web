/* Iframe Area Widget for ACP Lobby Screen */

/* exported IframeArea */
/*global $ */

function IframeArea(widget_id) {

    'use strict';

    var DEBUG=' iframe_area_log';

    var self = this;

    this.display = function (config, params) {
        self.config = config;
        self.params = params;
        self.log(widget_id, 'IframeArea',"Running display");
        do_load();
    };

    this.reload = function () {
        self.log(widget_id,'IframeArea',"Running reload", self.config.container_id);
        $('#' + self.config.container_id + ' iframe').attr("src", self.params.url);
        self.log(widget_id,'IframeArea',"reload done", self.config.container_id);
    };

    function do_load() {
        self.log("Running do_load", self.config.container_id);
        var frame = $('<iframe>')
                .attr('src', self.params.url)
        // 'scrolling=no' is deprecated but I can't find a cosponsoring CSS attribute
                .attr('scrolling', 'no');
        // Use scale to make the iframe bigger, and then transform it back down to fit.
        if ((typeof self.params.scale !== 'undefined') && self.params.scale > 0) {
            self.log('Scale factor', self.params.scale);
            frame.css({'width': 100/self.params.scale + '%',
                       'height': 100/self.params.scale + '%',
                       '-ms-transform': 'scale(' + self.params.scale + ')',
                       '-moz-transform': 'scale(' + self.params.scale + ')',
                       '-o-transform': 'scale(' + self.params.scale + ')',
                       '-webkit-transform': 'scale(' + self.params.scale + ')',
                       'transform': 'scale(' + self.params.scale + ')',
                       '-ms-transform-origin': '0 0',
                       '-moz-transform-origin': '0 0',
                       '-o-transform-origin': '0 0',
                       '-webkit-transform-origin': '0 0',
                       'transform-origin': '0 0'
                      });
        }
        $('#' + self.config.container_id).empty().append(frame);
        self.log(widget_id,"do_load done", self.config.container_id);
    } // end do_load()

    self.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('iframe_area_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var widget_config = new WidgetConfig(config);

        self.log(widget_id,'IframeArea configuring widget with', config, params);

        self.config = config;

        var config_div = document.getElementById(config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
                config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var config_title = document.createElement('h1');
        config_title.innerHTML = 'Configure Iframe';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');

        config_div.appendChild(config_form);

        var input_result = input_iframe_area(widget_config,
                                             config_form,
                                             params);

        return input_result;
    }

    // input_iframe_area
    //   widget_config: an instantiated object from widget-config.js providing .input and .choose
    //   parent_el: the DOM element this input form will be added to
    //   params: the existing parameters of the widget
    function input_iframe_area(widget_config, parent_el, params) {

        self.log(widget_id,'input_iframe_area with',params);

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = "This widget displays a web page of your choice.";
        config_info_text += " Enter the selected URL, e.g. http://people.ds.cam.ac.uk/jw35/.";
        config_info_text += " Note the page must be happy showing within an 'iframe' on the smartpanel.";
        config_info1.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info1);

        var config_info3 = document.createElement('p');
        config_info_text = "'Scale' shrinks or magnifies the web page, e.g. 0.5 will shrink to half size, 2 will magnify.";
        config_info3.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info3);

        var config_table = document.createElement('table');
        config_table.className = 'config_input_iframe_area';

        var config_tbody = document.createElement('tbody');

        // Each config_input(...) will return a .value() callback function for the input data

        // URL
        //
        var url_result = widget_config.input( config_tbody,
                                         'string',
                                         { text: 'Website URL:',
                                             title: 'The web address of the page you want to display, e.g. http://people.ds.cam.ac.uk/jw35/'
                                         },
                                         params.url);

        // SCALE
        //
        var scale_result = widget_config.input( config_tbody,
                                         'number',
                                         { text: 'Scale:',
                                           title: 'E.g. 0.5 will display page at half normal size, 2 will magnify to double'
                                         },
                                         params.scale);
        config_table.appendChild(config_tbody);
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // url
            config_params.url = url_result.value();

            config_params.scale = scale_result.value();

            self.log(self.widget_id,'input_iframe_area returning params:',config_params);

            return config_params;
        }

        var config_fn = function () {
            return { title: url_result.value() };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    }// end input_stop-timetable()
    self.log(widget_id,"Instantiated IframeArea");

}
