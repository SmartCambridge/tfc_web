/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(config, params) {

    'use strict';

    var self = this;

    var DEBUG = ' station_board_log';

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

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

    var config_id = widget_id+'_config'; // id of config div

    this.params = params;

    this.init = function () {
        this.log("Running init", widget_id);
        // debug - add a 'configure' link to the bottom of the page
        // and create an initially hidden config div for the widget to use
        // **
        var config_div = document.createElement('div');
        var config_link = document.createElement('a');
        var config_text = document.createTextNode('DEBUG Configure StationBoard');
        config_link.appendChild(config_text);
        config_link.title = "Configure this widget";
        config_link.href = "#";
        config_link.onclick = function () { self.configure(); };
        config_div.appendChild(config_link);
        document.body.appendChild(config_div);

        var config_div = document.createElement('div');
        config_div.setAttribute('id',config_id);
        config_div.setAttribute('class','station_board_config_div');
        document.body.appendChild(config_div);

        // **

        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload ", widget_id);
        this.do_load();
    }*/

    this.configure = function () {

        this.log('configuring widget', widget_id,'with', config_id);

        var config_div = document.getElementById(config_id);

        config_div.style.display = 'block';

        config_div.appendChild(document.createTextNode('Hello World'));
    }

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

    this.log("Instantiated StationBoard", widget_id, params);

}
