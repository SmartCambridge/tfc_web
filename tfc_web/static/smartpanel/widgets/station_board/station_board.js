/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(config, params) {

    'use strict';

    var self = this;

    //var DEBUG = ' station_board_log';

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var widget_id = config.container;

    this.container = widget_id; // will remove when we migrate framework to provide widget_id

    // *****************************************************************************
    // ******** CONFIG DEMO ********************************************************
    var CONFIG_SHIM = true;
    var CONFIG_COLOR = '#ffffe6';

    // *****************************************************************************

    self.params = params;

    this.init = function () {

        this.log("Running init", widget_id, 'with params', self.params );

        // ***********************************************************
        // **   CONFIG DEMO                                         **
        if (CONFIG_SHIM)
        {
            shim_link(self, widget_id);
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

        var CONFIG_TITLE = 'Configure Train Station Info';

        self.log('StationBoard configuring widget with', config.config_id, params);

        var config_div = document.getElementById(config.config_id);

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

        var input_result = input_widget(config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the StopTimetable parameters
    function input_widget(parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Stations select
        //
        self.log('configure() calling config_input', 'station', 'with',params.station);
        var station_result = config_input(  parent_el,
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
        var offset_result = config_input( parent_el,
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
        var value = function () {
            var config_params = {};
            // station
            config_params.station = station_result.value();

            // offset
            var offset = offset_result.value();
            if (!isNaN(parseInt(offset)) && offset >= 0) {
                config_params.offset = parseInt(offset);
            }

            self.log(widget_id,'returning params:',config_params);

            return config_params;
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 value: value };

    } // end input_widget()

    this.log("Instantiated StationBoard", widget_id, params);

} // end StationBoard

