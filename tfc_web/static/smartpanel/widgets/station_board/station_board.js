/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(config, params) {

    'use strict';

    var self = this;

    var DEBUG = ' station_board_log';

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var CONFIG_COLOR = '#ffffe6';

    // Backwards compatibility or first argument
    var widget_id;
    if (typeof(config) === 'string') {
        widget_id = config;
    }
    else {
        this.config = config;
        widget_id = config.container;
    }
    this.container = widget_id;

    var config_id = widget_id+'_config'; // DOM id of config div

    var config_params_elements = {}; // DOM id's (station, offset) for params form elements

    this.params = params;

    this.init = function () {
        this.log("Running init", widget_id);

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

            //self.log('top',Math.round(rect.top), 'right',Math.round(rect.right),'bottom', Math.round(rect.bottom), 'left',Math.round(rect.left));

            // create 'edit' link
            var config_link = document.createElement('a');
            var config_text = document.createTextNode('edit');
            config_link.appendChild(config_text);
            config_link.title = "Configure this widget";
            config_link.href = "#";
            config_link.onclick = click_configure;
            config_link.style = 'position: absolute; z-index: 1001';
            config_link.style.left = Math.round(rect.left+width - 50)+'px';
            config_link.style.top = Math.round(rect.top)+'px';
            document.body.appendChild(config_link);

            // create config div for properties form
            var config_div = document.createElement('div');
            config_div.setAttribute('id',config_id);
            config_div.setAttribute('class','station_board_config');
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
        var url = "/smartpanel/station_board?station=" + this.params.station;
        if (this.params.offset) {
            url += "&offset=" + this.params.offset;
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
    this.configure = function (config_id) {

        this.log('configuring widget', widget_id,'with', config_id);

        var config_properties = '{                                              \
            "properties": {                                                     \
                                                                                \
                "station": {                                                    \
                    "type": "string",                                           \
                    "enum": ["CBG", "CMB", "WBC", "SED", "WLF", "FXN", "STH"],  \
                    "display": {                                                \
                        "CBG": "Cambridge",                                     \
                        "CMB": "Cambridge North",                               \
                        "WBC": "Waterbeach",                                    \
                        "SED": "Shelford",                                      \
                        "WLF": "Whittlesford",                                  \
                        "FXN": "Foxton",                                        \
                        "STH": "Shepreth"                                       \
                    },                                                          \
                    "title": "Station",                                         \
                    "description": "Station name",                              \
                    "format": "smartpanel:train_station"                        \
                },                                                              \
                                                                                \
                "offset": {                                                     \
                    "type": "integer",                                          \
                    "title": "Timing offset",                                   \
                    "description": "Offset from now to the start of the timetable (in minutes)", \
                    "minimum": -120,                                            \
                    "maximum": 120,                                             \
                    "default": 0                                                \
                }                                                               \
            }';

        var config_div = document.getElementById(config_id);

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

        // Stations select
        //
        var row = config_select( 'station',
                                 { text: 'Station:',
                                   title: 'Choose your station from the dropdown',
                                   options: [ { value: 'CBG', text: 'Cambridge' },
                                              { value: 'CMB', text: 'Cambridge North' },
                                              { value: 'FXN', text: 'Foxton' },
                                              { value: 'SED', text: 'Shelford' } ]
                                 });
        config_tbody.appendChild(row);

        // offset input
        //
        row = config_input( 'offset',
                            { text: 'Timing offset (mins):',
                              title: 'Set an offset (mins) if you want times for *later* trains than now',
                              type: 'number',
                              step: 'any'
                            });

/*
        var id = config_id + '_offset';
        row = document.createElement('tr');
        var name = document.createElement('td');
        name.class = 'config_property_name';
        name.innerHTML =
            '<label for="'+id+'"'+
                 '" title="Timing offset - use this if you want times for *later* trains than now">'+
                 'Timing offset (mins):'+
            '</label>';
        row.appendChild(name);
        var value = document.createElement('td');
        value.class = 'config_property_value';
        var input = document.createElement('input');
        input.id = id;
        input.type = 'number';
        input.step = 'any';
        input.title = 'Timing offset (mins)';
        config_params_elements['offset'] = input;
        value.appendChild(input);
        row.appendChild(value);
*/
        config_tbody.appendChild(row);

        config_table.appendChild(config_tbody);
        config_form.appendChild(config_table);

        config_div.appendChild(config_form);

        // Add save / cancel buttons

        var save_button = document.createElement('button');
        save_button.onclick = click_save;
        save_button.innerHTML = 'Save';
        config_div.appendChild(save_button);

        var cancel_button = document.createElement('button');
        cancel_button.onclick = click_cancel;
        cancel_button.innerHTML = 'Cancel';
        config_div.appendChild(cancel_button);

    }// end this.configure()

    // user has clicked the (debug) 'Configure' button
    // This is a 'shim' for the call from the Widget Framework
    function click_configure() {
        var widget = document.getElementById(widget_id);
        widget.style['background-color'] = CONFIG_COLOR;
        self.configure(config_id);
    }

    // user has clicked the 'Cancel' button
    function click_cancel() {

        // HERE WE WILL CALL THE CONFIGURATION FRAMEWORK

        // In the meantime, here is a 'shim' that updates the layout
        // *************************************************************
        // **                                                         **
        // reset original widget background-color to WHITE
        var widget = document.getElementById(widget_id);
        if (widget) widget.style['background-color'] = 'white';

        // hide the config div
        var config = document.getElementById(config_id);
        config.style.display = 'none';
        // **                                                         **
        // *************************************************************

        self.log(config_id, 'cancel button');
    }

    // user has clicked the 'Save' button
    function click_save() {
        self.log(config_id, 'save_button');

        var config_params = {};
        // station
        config_params.station = config_params_elements['station'].value;

        // offset
        var offset = config_params_elements['offset'].value;
        if (!isNaN(parseInt(offset)) && offset >= 0) {
            config_params.offset = offset;
        }

        self.log(config_id,'returning params:',config_params);

        // HERE IS WHERE WE WILL RETURN THE config_params TO THE WIDGET FRAMEWORK
        // The framework should then deal with (close) the config div

        // Alternatively, we'll 'shim' the 'save' function by updating in the layout
        // Minor safety-check: make sure there is a widget on the page
        var widget = document.getElementById(widget_id);
        if (widget_id) {
            // Here we update the existing widget 'in-place', not expected in production

            self.params = config_params;

            self.log(widget_id,'config reset params to',self.params);

            // reset original widget background-color to WHITE
            var widget = document.getElementById(widget_id);
            if (widget) widget.style['background-color'] = 'white';

            // hide the config div
            var config = document.getElementById(config_id);
            config.style.display = 'none';

            self.init();
        }

    }

    // Configure: return a TABLE ROW containing a SELECT param input
    // param_name: widget config parameter name, e.g. 'station'
    // options: { text: text display before dropdown
    //            title: helper text
    //            options: [ { value: <key>, text: <displayname> } ... ]
    //          }
    function config_select(param_name, options) {
        var id = config_id + '_' + param_name;
        var row = document.createElement('tr');

        // create td to hold 'name' prompt for field
        var name = document.createElement('td');
        name.class = 'config_property_name';
        var label = document.createElement('label');
        label.for = id;
        label.title = options.title;
        label.appendChild(document.createTextNode(options.text));
        name.appendChild(label);
        row.appendChild(name);
        var value = document.createElement('td');
        value.class = 'config_property_value';
        var sel = document.createElement('select');
        if (options.title) sel.title = options.title;
        sel.id = id;
        var select_options = options.options;
        for (var i=0; i<select_options.length; i++) {
            var opt = document.createElement('option');
            opt.value = select_options[i].value;
            opt.text = select_options[i].text;
            sel.appendChild(opt);
        }
        config_params_elements[param_name] = sel; // add input element to global dict for Save
        value.appendChild(sel);
        row.appendChild(value);

        return row;
    }

    // Return a table row with a simple input field
    function config_input(param_name, options)
    {
        var id = config_id + '_' + param_name;
        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field
        var name = document.createElement('td');
        name.class = 'config_property_name';
        var label = document.createElement('label');
        label.for = id;
        label.title = options.title;
        label.appendChild(document.createTextNode(options.text));
        name.appendChild(label);
        row.appendChild(name);
        var value = document.createElement('td');
        value.class = 'config_property_value';

        var input = document.createElement('input');
        input.id = id;
        if (options.type) input.type = options.type;
        if (options.step) input.step = options.step;
        if (options.title) input.title = options.title;

        config_params_elements[param_name] = input;
        value.appendChild(input);
        row.appendChild(value);

        return row;
    }

    this.log("Instantiated StationBoard", widget_id, params);

} // end StationBoard

