/* Weather Widget for ACP Lobby Screen */

/* global $, DEBUG */
/* exported Weather */

function Weather(config, params) {

    'use strict';

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
    this.params = params;

    this.init = function () {
        this.log('Running init', this.container);
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

    this.log('Instantiated Weather', container, params);

}