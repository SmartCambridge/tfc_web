/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(container, params) {

    'use strict';

    this.container = container;
    this.params = params;

    this.init = function () {
        this.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log("Running StationBoard.do_load", this.container);
        var self = this,
            url = "widget/station_board?station=" + this.params.station +
                "&offset=" + this.params.offset + " .station_board";
        this.log("do_load URI", url);
        this.log("Container", '#' + this.container);
        $('#' + this.container).load(url, function (response, status, xhr) {
            if (status === 'error') {
                self.log("Error loading station board", xhr.status, xhr.statusText);
                $('#' + self.container + ' .widget_error').show();
            }
            else {
                $('#' + self.container + ' .widget_error').hide();
            }
            setTimeout(function () { self.do_load(); }, 60000);
        });
        this.log("do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('station_board_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated StationBoard", container, params);

}