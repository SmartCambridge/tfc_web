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

    var config_inputs = {}; // DOM id's (station, offset) for params form elements

    var params = params;//this.params = params;

    this.init = function () {
        this.log("Running init", widget_id, 'with params', params ); //this.params );

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
            config_link.onclick = shim_click_configure;
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
        var url = "/smartpanel/station_board?station=" + params.station;//this.params.station;
        if (params.offset) { //(this.params.offset) {
            url += "&offset=" + params.offset;// this.params.offset;
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
                        params);
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

        // initialize global dictionary config_inputs
        config_inputs = {};

        // Stations select
        //
        self.log('configure() calling config_input', 'station', 'with',params.station);
        config_input( config_tbody,
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
        config_input( config_tbody,
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
        save_button.onclick = function () { return config_click_save(config); };
        save_button.innerHTML = 'Save';
        config_div.appendChild(save_button);

        var cancel_button = document.createElement('button');
        cancel_button.onclick = function () { return config_click_cancel(config); };
        cancel_button.innerHTML = 'Cancel';
        config_div.appendChild(cancel_button);

    }// end this.configure()

    // user has clicked the 'Cancel' button
    function config_click_cancel(config) {

        // HERE WE WILL CALL THE CONFIGURATION FRAMEWORK

        // In the meantime, here is a 'shim' that updates the layout
        // *************************************************************
        //config_shim_cancel();
        config.configuration_callback(null);
    }

    // user has clicked the 'Save' button
    function config_click_save(config) {
        self.log(config_id, 'save_button');

        var config_params = {};
        // station
        config_params.station = config_inputs['station'].value();

        // offset
        var offset = config_inputs['offset'].value();
        if (!isNaN(parseInt(offset)) && offset >= 0) {
            config_params.offset = offset;
        }

        self.log(config.config_id,'returning params:',config_params);

        // HERE IS WHERE WE WILL RETURN THE config_params TO THE WIDGET FRAMEWORK
        // The framework should then deal with (close) the config div

        // Alternatively, we'll 'shim' the 'save' function by updating in the layout
        //config_shim_save(config_params);
        config.configuration_callback(config_params);
    }

    // ************************************************************************************
    // *****************  Library Widget Configuration ************************************
    // ************************************************************************************
    //
    // THESE ARE GENERAL PURPOSE CONFIG INPUT FUNCTIONS, should be in common widget.js
    //
    // config_input will append a <tr> to the parent object 'parent_el'
    // and add an entry to the global dictionary:
    // config_inputs[param_name] = { type: param_type,
    //                               options: param_options,
    //                               value: a function that returns the value }
    //
    // config_input(
    //   parent_el:     DOM object to append input element (tbody)
    //   param_name:    property name for widget, e.g. 'station'.
    //   param_type:    'select' | 'string' | 'number'
    //   param_options: options needed for each input type
    //   param_current: current value of property (for edit)
    //   )
    // 'select': { text: text display before dropdown
    //             title: helper text
    //             options: [ { value: <key>, text: <displayname> } ... ]
    //            }
    //
    // 'string':  { text:
    //              title:
    //            });
    //
    // 'number':  { text:
    //              title:
    //              step: 'any' *[OPTIONAL]
    //            });
    function config_input(parent_el, param_name, param_type, param_options, param_current) {
        self.log('creating input', param_name, param_type, param_options, param_current);
        config_inputs[param_name] = {};
        config_inputs[param_name].type = param_type;
        config_inputs[param_name].options = param_options;
        switch (param_type) {
            case 'select':
                parent_el.appendChild(config_select(param_name, param_options, param_current));
                break;

            case 'string':
                parent_el.appendChild(config_string(param_name, param_options, param_current));
                break;

            case 'number':
                parent_el.appendChild(config_number(param_name, param_options, param_current));
                break;

            default:
                self.log(widget_id, 'bad param_type in config_input', param_type);
        }

        return null;
    }

    function config_select(param_name, options, param_current) {
        self.log('creating select element', param_name, 'with', param_current);
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
        // set default value of input to value provided in param_current
        if (param_current) sel.value = param_current;
        config_inputs[param_name].element = sel; // add input element to global dict for Save
        config_inputs[param_name].value = function () { return sel.value; };
        value.appendChild(sel);
        row.appendChild(value);

        return row;
    }

    function config_number(param_name, param_options, param_current) {
        if (!param_options.type) param_options.type = 'number';
        return config_string(param_name, param_options, param_current);
    }

    // Return a table row with a simple input field
    function config_string(param_name, options, param_current)
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

        // set default value of input to value provided in param_current
        self.log(param_name,'default set to',param_current);
        if (param_current) input.value = param_current;

        config_inputs[param_name].element = input;
        config_inputs[param_name].value = function() { return input.value; };
        value.appendChild(input);
        row.appendChild(value);

        return row;
    }

    // A 'shim' callback for the configuration results
    function config_shim_callback(config_params) {
        if (config_params) {
            config_shim_save(config_params);
        } else {
            config_shim_cancel();
        }
    }

    // A shim function to provide the 'config cancel' in the active layout
    function config_shim_cancel() {
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

    // A shim function to provide the 'config save' in the active layout
    function config_shim_save(config_params) {
        // Here we update the existing widget 'in-place', not expected in production

        params = config_params; //self.params = config_params;

        self.log(widget_id,'config reset params to',params);//self.params);

        var widget = document.getElementById(widget_id);

        // reset original widget background-color to WHITE
        widget.style['background-color'] = 'white';

        // hide the config div
        var config = document.getElementById(config_id);
        config.style.display = 'none';

        self.init();
    }

    this.log("Instantiated StationBoard", widget_id, params);

} // end StationBoard

