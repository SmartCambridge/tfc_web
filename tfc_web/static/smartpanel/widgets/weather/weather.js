/* Weather Widget for ACP Lobby Screen */

/* global $, DEBUG */
/* exported Weather */

function Weather(config, params) {

    'use strict';

    var CONFIG_SHIM = true;
    var self = this;

    // Backwards compatibility or first argument
    var container;
    if (typeof(config) === 'string') {
        container = config;
    }
    else {
        this.config = config;
        container = config.container;
    }
    this.container = container;

    var widget_id = config.container;

    this.params = params;

    this.init = function () {
        this.log('Running init', this.container);
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
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log('Running Weather.do_load', this.container);
        var self = this,
            url = '/smartpanel/weather?location=' + this.params.location +
                ' .content_area';
        this.log('do_load URI', url);
        this.log('Container', '#' + this.container);
        $('#' + this.container).load(url, function (response, status, xhr) {
            if (status === 'error') {
                self.log('Error loading station board', xhr.status, xhr.statusText);
                $('#' + self.container + ' .widget_error').show();
            }
            else {
                $('#' + self.container + ' .widget_error').hide();
            }
            setTimeout(function () { self.do_load(); }, 60000);
        });
        this.log('do_load done', this.container);
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
    this.configure = function (config, params) {

        var config_div = document.getElementById(config.config_id);

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

        var input_result = input_weather(config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the Weather parameters
    function input_weather(parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Location select
        //
        var location_result = config_input(  parent_el,
                                            'select',
                                            { text: 'Location:',
                                              title: 'Choose your weather location from the dropdown',
                                              options: [ { value: '310042', text: 'Cambridge' },
                                                         { value: '310105', text: 'Luton' },
                                                         { value: '310120', text: 'Peterborough' },
                                                         { value: '353656', text: 'Stansted' }
                                                       ]
                                            },
                                            params.location
                                         );

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value = function () {
            var config_params = {};
            // location
            config_params.location = location_result.value();

            self.log(widget_id,'returning params:',config_params);

            return config_params;
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 value: value };

    }// end input_weather()

    this.log('Instantiated Weather', container, params);

}
