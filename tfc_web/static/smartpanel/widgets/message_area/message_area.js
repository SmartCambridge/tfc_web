/* Message Area Widget for ACP Lobby Screen */

/*global DEBUG, sanitizeHtml */

/* exported MessageArea */

function MessageArea(config, params) {

    'use strict';

    var self = this;

    var DEBUG = ' message_area_log';

    var widget_id = config.container;

    this.container = widget_id; // will remove when we migrate framework to provide widget_id

    // *****************************************************************************
    // ******** CONFIG DEMO ********************************************************
    var CONFIG_SHIM = true;
    var CONFIG_COLOR = '#ffffe6';

    // *****************************************************************************

    self.params = params;

    this.init = function () {

        this.log("Running init", widget_id, 'with params', self.params );

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
        this.log('Running do_load', widget_id);

        var container = document.getElementById(this.container);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (container.firstChild) {
                container.removeChild(container.firstChild);
        }

        var title = document.createElement('h1');
        var img = document.createElement('img');
        img.setAttribute('src', config.static_url + 'black-bubble-speech.png');
        img.setAttribute('alt', '');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode(self.params.title));
        container.appendChild(title);

        var message = document.createElement('div');
        message.innerHTML = safe(self.params.message);
        container.appendChild(message);

        this.log(widget_id,'do_load done');
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

    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var CONFIG_TITLE = 'Configure Message Info';

        self.log('StationBoard configuring widget with', config.config_id, params);

        var config_div = document.getElementById(config.config_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
                config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var title = document.createElement('h1');
        title.innerHTML = CONFIG_TITLE;

        config_div.appendChild(title);

        var config_form = document.createElement('form');

        var input_result = input_widget(config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the StopTimetable parameters
    function input_widget(parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // title input
        //
        var title_result = config_input( parent_el,
                                          'string',
                                          { text: 'Title:',
                                            title: 'Choose your bold heading for this widget'
                                          },
                                          params.title);

        // message input
        //
        var message_result = config_input( parent_el,
                                          'string',
                                          { text: 'Message:',
                                            title: 'Enter your message text (can contain basic html markup)',
                                            format: 'textarea'
                                          },
                                          params.message);

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value = function () {
            var config_params = {};
            // title
            config_params.title = title_result.value();

            // message
            config_params.message = message_result.value();

            self.log(widget_id,'returning params:',config_params);

            return config_params;
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 value: value };

    }// end input_widget()

    this.log('Instantiated MessageArea', widget_id, params);

}
