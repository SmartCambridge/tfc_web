/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(config, params) {

    'use strict';

    var self = this;

    var DEBUG = ' station_board_log';

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var widget_id = config.container;

    this.container = widget_id; // will remove when we migrate framework to provide widget_id

    // *****************************************************************************
    // ******** CONFIG DEMO ********************************************************
    var config_id = widget_id+'_config'; // DOM id of config div

    var CONFIG_COLOR = '#ffffe6';

    // *****************************************************************************

    var config_inputs = {}; // DOM id's (station, offset) for params form elements

    self.params = params;

    this.init = function () {
        this.log("Running init", widget_id, 'with params', self.params );

        // debug - add a 'configure' link to the bottom of the page
        // and create an initially hidden config div for the widget to use.
        // The LAYOUT CONFIGURATION FRAMEWORK would be expected to do this
        // ***********************************************************
        // **                                                       **
        if (!document.getElementById(config_id))
        {
            var widget = document.getElementById(widget_id);

            // get absolute coords of widget (so we can position 'edit' link)
            var rect = widget.getBoundingClientRect();
            var top = Math.round(rect.top);
            var left = Math.round(rect.left);
            var width = Math.round(widget.offsetWidth);

            // create 'edit' link
            var config_link = document.createElement('a');
            var config_text = document.createTextNode('edit');
            config_link.appendChild(config_text);
            config_link.title = "Configure this widget";
            config_link.href = "#";
            config_link.onclick = shim_click_configure;
            config_link.style = 'position: absolute; z-index: 1001';
            config_link.style.left = Math.round(rect.left+width - 50)+'px';
            config_link.style.top = Math.round(rect.top)+'px';
            document.body.appendChild(config_link);

            // create config div for properties form
            var config_div = document.createElement('div');
            config_div.setAttribute('id',config_id);
            config_div.setAttribute('class','widget_config');
            document.body.appendChild(config_div);
        }
        // **                                                       **
        // ***********************************************************

        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload ", widget_id);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log("Running StationBoard.do_load", widget_id);
        //var self = this;
        var url = "/smartpanel/station_board?station=" + self.params.station;
        if (self.params.offset) {
            url += "&offset=" + self.params.offset;
        }
        url += " .content_area";

        this.log("do_load URI", url);
        this.log("Container", '#' + widget_id);
        $('#' + widget_id).load(url, function (response, status, xhr) {
            if (status === 'error') {
                self.log("Error loading station board", xhr.status, xhr.statusText);
                $('#' + widget_id + ' .widget_error').show();
            }
            else {
                $('#' + widget_id + ' .widget_error').hide();
            }
            setTimeout(function () { self.do_load(); }, 60 * SECONDS);
        });

        this.log("do_load done", widget_id);
    };

    // user has clicked the (debug) 'Configure' button
    // This is a 'shim' for the call from the Widget Framework
    function shim_click_configure() {
        var widget = document.getElementById(widget_id);
        widget.style['background-color'] = CONFIG_COLOR;
        self.configure( { widget_id: widget_id,
                          config_id: config_id,
                          configuration_callback: config_shim_callback
                        },
                        self.params);
    }

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('station_board_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        this.log('configuring widget', config.widget_id,'with', config.config_id);

        var config_div = document.getElementById(config.config_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
                config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var config_title = document.createElement('h1');
        config_title.innerHTML = 'Configure Station Board';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');
        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // initialize global dictionary config_inputs[<property name>] -> { value: function to return input data }
        config_inputs = {};

        // Each config_input(...) will return a .value() callback function for the input data

        // Stations select
        //
        self.log('configure() calling config_input', 'station', 'with',params.station);
        config_inputs['station'] = config_input(  config_tbody,
                                                  'station',
                                                  'select',
                                                  { text: 'Station:',
                                                    title: 'Choose your station from the dropdown',
                                                    options: [ { value: 'CBG', text: 'Cambridge' },
                                                               { value: 'CMB', text: 'Cambridge North' },
                                                               { value: 'FXN', text: 'Foxton' },
                                                               { value: 'SED', text: 'Shelford' } ]
                                                  },
                                                  params.station
                                                );

        // offset input
        //
        self.log('configure() calling config_input', 'offset', 'with',params.offset);
        config_inputs['offset'] = config_input(   config_tbody,
                                                  'offset',
                                                  'number',
                                                  { text: 'Timing offset (mins):',
                                                    title: 'Set an offset (mins) if you want times for *later* trains than now',
                                                    step: 'any'
                                                  },
                                                  params.offset);

        config_table.appendChild(config_tbody);
        config_form.appendChild(config_table);

        config_div.appendChild(config_form);

        // Add save / cancel buttons

        var save_button = document.createElement('button');
        save_button.onclick = function () { return config_click_save(config, config_inputs); };
        save_button.innerHTML = 'Save';
        config_div.appendChild(save_button);

        var cancel_button = document.createElement('button');
        cancel_button.onclick = function () { return config_click_cancel(config); };
        cancel_button.innerHTML = 'Cancel';
        config_div.appendChild(cancel_button);

    }// end this.configure()

    // user has clicked the 'Cancel' button
    function config_click_cancel(config) {

        // HERE'S WHERE WE CALL THE CONFIGURATION FRAMEWORK

        config.configuration_callback(config, null);
    }

    // user has clicked the 'Save' button
    function config_click_save(config, config_inputs) {
        self.log(config.config_id, 'save_button');

        var config_params = {};
        // station
        config_params.station = config_inputs['station'].value();

        // offset
        var offset = config_inputs['offset'].value();
        if (!isNaN(parseInt(offset)) && offset >= 0) {
            config_params.offset = parseInt(offset);
        }

        self.log(config.config_id,'returning params:',config_params);

        // HERE IS WHERE WE RETURN THE config_params TO THE WIDGET FRAMEWORK
        // The framework should then deal with (close) the config div
        config.configuration_callback(config, config_params);
    }

    // A 'shim' callback for the configuration results
    function config_shim_callback(config, config_params) {
        if (config_params) {
            config_shim_save(self, config, config_params);
        } else {
            config_shim_cancel(self, config);
        }
    }

    this.log("Instantiated StationBoard", widget_id, params);

} // end StationBoard

