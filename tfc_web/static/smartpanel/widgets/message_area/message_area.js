/* Message Area Widget for ACP Lobby Screen */

/*global $, DEBUG, sanitizeHtml */

/* exported MessageArea */

function MessageArea(config, params) {

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
        this.log('Running do_load', this.container);

        $('#' + this.container).html(
            '<h1>' +
            '<img src="' + config.static_url + 'black-bubble-speech.png" alt=""> '+
            params.title +
            '</h1>' +
            safe(params.message));
        this.log('do_load done', this.container);
    };

    function safe(dirty) {
        return sanitizeHtml(dirty, {
            allowedTags: [ 'p', 'a', 'ul', 'ol', 'li', 'b', 'i', 'strong',
            'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead',
            'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img'],
            allowedAttributes: {
                'a': [ 'href' ],
                'img': [ 'src' ],
            }
        });
    }

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('message_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log('Instantiated MessageArea', this.container, params);

}