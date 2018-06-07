/* Weather Widget for ACP Lobby Screen */

/* global $, DEBUG */
/* exported Weather */

// 'widget_id' can be config object
// 'params' only for backwards compatibility with previous layout framework
function Weather(widget_id) {

    'use strict';

    var DEBUG = ' weather_log';

    var self = this;

    self.widget_id = widget_id;

    var WEATHER_OPTIONS = [ { value: '310042', text: 'Cambridge' },
                            { value: '351524', text: 'Fulbourn' },
                            { value: '310105', text: 'Luton' },
                            { value: '310120', text: 'Peterborough' },
                            { value: '353656', text: 'Stansted' }
                          ];

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        self.log(self.widget_id, 'Running Weather.do_load');
        var url = '/smartpanel/weather?location=' + this.params.location +
                ' .content_area';
        self.log(self.widget_id, 'do_load URI', url);
        self.log('Container', '#' + self.config.container_id);
        $('#' + self.config.container_id).load(url, function (response, status, xhr) {
            if (status === 'error') {
                self.log(self.widget_id,'Error loading station board', xhr.status, xhr.statusText);
                $('#' + self.config.container_id + ' .widget_error').show();
            }
            else {
                $('#' + self.config.container_id + ' .widget_error').hide();
            }
            setTimeout(function () { self.do_load(); }, 60000);
        });
        self.log(self.widget_id,'do_load done');
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('weather_log') >= 0) {
            console.log.apply(console, arguments);
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
        config_title.innerHTML = 'Configure Weather';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');

        var input_result = input_weather(widget_config, config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the Weather parameters
    function input_weather(widget_config, parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Location select
        //
        var location_result = widget_config.input(  parent_el,
                                            'select',
                                            { text: 'Location:',
                                              title: 'Choose your weather location from the dropdown',
                                              options: WEATHER_OPTIONS
                                            },
                                            params.location
                                         );

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // location
            config_params.location = location_result.value();

            self.log(self.widget_id,'returning params:',config_params);

            return config_params;
        };

        var config_fn = function () {
            var weather_text = 'Location';
            var weather_value = location_result.value();
            for (var i=0; i<WEATHER_OPTIONS.length; i++) {
                if (WEATHER_OPTIONS[i].value === weather_value) {
                    weather_text = WEATHER_OPTIONS[i].text;
                    break;
                }
            }
            return { title: weather_text + " Weather" };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    }// end input_weather()

    self.log(self.widget_id, 'Instantiated Weather');

}
