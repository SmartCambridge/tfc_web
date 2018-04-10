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
        if (!config_div)
        {
            var config_link = document.createElement('a');
            var config_text = document.createTextNode('DEBUG Configure StationBoard');
            config_link.appendChild(config_text);
            config_link.title = "Configure this widget";
            config_link.href = "#";
            config_link.onclick = click_configure;
            document.body.appendChild(config_link);

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

        // Note - using innerHTML as a 'quick' development method.
        // Could replace this with document.createElement() and not need id's
        var form = '<table>'; // class="station_board_config_table">';
        form += '<tbody>';

        var config_params_station = config_id +'_params_station'; // DOM id for station select dropdown / label
        form += '<tr>';
        form += '<td class="station_board_config_property_name">';
        form += '<label for="'+config_params_station+'" title="Station name">Station:<sup>*</sup></label>';
        form += '</td>';
        form += '<td class="station_board_config_property_value">';
        form += '<select title="Station name" id="'+config_params_station+'">';
        form += '<option value="CBG">Cambridge</option>';
        form += '<option value="CMB">Cambridge North</option>';
        form += '<option value="FXN">Foxton</option>';
        form += '<option value="SED">Shelford</option>';
        form += '<option value="STH">Shepreth</option>';
        form += '<option value="WBC">Waterbeach</option>';
        form += '<option value="WLF">Whittlesford</option>';
        form += '</select>';
        form += '</td>';
        form += '</tr>';

        var config_params_offset = config_id+'_params_offset'; // DOM id for timing offset input / label
        form += '<tr>';
        form += '<td class="station_board_config_property_name">';
        form += '<label for="'+config_params_offset+
                     '" title="Timing offset - use this if you want times for *later* trains than now">'+
                     'Timing offset (mins):'+
                '</label>';
        form += '</td>';
        form += '<td class="station_board_config_property_value">';
        form += '<input type="number" step="any" title="Timing offset (mins)" id="'+config_params_offset+'">';
        form += '</td>';
        form += '</tr>';

        form += '</tbody>';
        form += '</table>';
        form += '</form>';

        var config_form = document.createElement('form');
        config_form.innerHTML = form;

        config_div.appendChild(config_form);

        config_params_elements['station'] = document.getElementById(config_params_station);
        config_params_elements['offset'] = document.getElementById(config_params_offset);

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

            // hide the config div
            var config = document.getElementById(config_id);
            config.style.display = 'none';

            self.init();
        }

    }

    this.log("Instantiated StationBoard", widget_id, params);

} // end StationBoard

