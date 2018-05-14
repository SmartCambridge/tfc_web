/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(widget_id, params) {

    'use strict';

    //var DEBUG = ' station_board_log';

    var CONFIG_SHIM = true;

    var self = this;

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    if (typeof(widget_id) === 'string') {
        self.widget_id = widget_id;
    }
    else {
        // Backwards compatibility
        self.config = widget_id;
        self.widget_id = self.config.container;
        self.config.container_id = self.config.container;
        self.params = params;
    }

    var STATION_OPTIONS = [ { value: 'CBG', text: 'Cambridge' },
             { value: 'CMB', text: 'Cambridge North' },
             { value: 'FXN', text: 'Foxton' },
             { value: 'SED', text: 'Shelford' },
             { value: 'WLF', text: 'Whittlesford' }
    ];

    // backwards compatibility init() function
    this.init = function () {
        this.log(self.widget_id, 'Running StationBoard.init');

        this.display(self.config, self.params);

    };

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload ", widget_id);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log(self.widget_id, "Running StationBoard.do_load");
        //var self = this;
        var url = "/smartpanel/station_board?station=" + self.params.station;
        if (self.params.offset) {
            url += "&offset=" + self.params.offset;
        }
        url += " .content_area";

        this.log(self.widget_id, "do_load URI", url);
        this.log(self.widget_id, "Container", '#' + self.config.container_id);
        $('#' + self.config.container_id).load(url, function (response, status, xhr) {
            if (status === 'error') {
                self.log(self.widget_id, "Error loading station board", xhr.status, xhr.statusText);
                $('#' + self.config.container_id + ' .widget_error').show();
            }
            else {
                $('#' + self.config.container_id + ' .widget_error').hide();
            }
            setTimeout(function () { self.do_load(); }, 60 * SECONDS);
        });

        this.log(self.widget_id, "do_load done");
    };

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

        var widget_config = new WidgetConfig(config);

        var CONFIG_TITLE = 'Configure Train Station Info';

        self.log(self.widget_id, 'StationBoard configuring widget with', config.container_id, params);

        var config_div = document.getElementById(config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
                config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var title = document.createElement('h1');
        title.innerHTML = CONFIG_TITLE;

        config_div.appendChild(title);

        var config_form = document.createElement('form');

        var input_result = input_widget(widget_config, config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the StopTimetable parameters
    function input_widget(widget_config, parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Stations select
        //
        self.log(self.widget_id, 'configure() calling config_input', 'station', 'with',params.station);
        var station_result = widget_config.input(  parent_el,
                                            'select',
                                            { text: 'Station:',
                                              title: 'Choose your station from the dropdown',
                                              options: STATION_OPTIONS
                                            },
                                            params.station
                                         );

        // offset input
        //
        self.log(self.widget_id, 'configure() calling config_input', 'offset', 'with',params.offset);
        var offset_result = widget_config.input( parent_el,
                                          'number',
                                          { text: 'Timing offset (mins):',
                                            title: 'Set an offset (mins) if you want times for *later* trains than now',
                                            step: 'any'
                                          },
                                          params.offset);

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // station
            config_params.station = station_result.value();

            // offset
            var offset = offset_result.value();
            if (!isNaN(parseInt(offset)) && offset >= 0) {
                config_params.offset = parseInt(offset);
            }

            self.log(self.widget_id,'returning params:',config_params);

            return config_params;
        };

        var config_fn = function () {
            var selected_key = station_result.value();
            var selected_title = 'no station selected';
            for (var i=0; i<STATION_OPTIONS.length; i++) {
                if (STATION_OPTIONS[i].value === selected_key) {
                    selected_title = STATION_OPTIONS[i].text + ' Station';
                    break;
                }
            }

            return { title: selected_title }; };

        return { valid: function () { return true; }, //debug - still to be implemeinted,
                 config: config_fn,
                 value: value_fn };

    } // end input_widget()

    this.log(self.widget_id, "Instantiated StationBoard", self.params);

} // end StationBoard

