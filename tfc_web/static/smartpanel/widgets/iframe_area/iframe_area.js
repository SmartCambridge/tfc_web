/* Iframe Area Widget for ACP Lobby Screen */

/* exported IframeArea */
/*global $ */

function IframeArea(config, params) {

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
        this.log("Running init", this.container);
        this.do_load();
    };

    this.reload = function () {
        this.log("Running reload", this.container);
        $('#' + this.container + ' iframe').attr("src", this.params.url);
        this.log("reload done", this.container);
    };

    this.do_load = function () {
        this.log("Running do_load", this.container);
        var frame = $('<iframe>')
                .attr('src', this.params.url)
        // 'scrolling=no' is deprecated but I can't find a cosponsoring CSS attribute
                .attr('scrolling', 'no')
                .addClass('iframe_area');
        // Use scale to make the iframe bigger, and then transform it back down to fit.
        if ((typeof this.params.scale !== 'undefined') && this.params.scale > 0) {
            this.log('Scale factor', this.params.scale);
            frame.css({'width': 100/this.params.scale + '%',
                       'height': 100/this.params.scale + '%',
                       '-ms-transform': 'scale(' + this.params.scale + ')',
                       '-moz-transform': 'scale(' + this.params.scale + ')',
                       '-o-transform': 'scale(' + this.params.scale + ')',
                       '-webkit-transform': 'scale(' + this.params.scale + ')',
                       'transform': 'scale(' + this.params.scale + ')',
                       '-ms-transform-origin': '0 0',
                       '-moz-transform-origin': '0 0',
                       '-o-transform-origin': '0 0',
                       '-webkit-transform-origin': '0 0',
                       'transform-origin': '0 0'
                      });
        }
        $('#' + this.container).empty().append(frame);
        this.log("do_load done", this.container);
    };

    //DEBUG='iframe_area_log';
    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('iframe_area_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated IframeArea", container, params);

}