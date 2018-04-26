/* Traffic Map Widget for Twitter Timelines */

/*global $, DEBUG */
/* exported TwitterTimeline */

function TwitterTimeline(config, params) {

    'use strict';

    var self = this;

    //var DEBUG = ' station_board_log';

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var widget_id = config.container;

    this.container = widget_id; // will remove when we migrate framework to provide widget_id

    // *****************************************************************************
    // ******** CONFIG DEMO ********************************************************
    var CONFIG_SHIM = true;
    var CONFIG_COLOR = '#ffffe6';

    // *****************************************************************************

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
        this.log("Running TwitterTimeline.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log('Running do_load', this.container);
        var container_width = $('#' + this.container).width(),
            container_height = $('#' + this.container).height(),
            tag = $('<a class="twitter-timeline" ' +
                'data-lang="en" ' +
                'data-width="' + container_width + '" ' +
                'data-height="' + container_height + '" ' +
                'data-dnt="true" ' +
                'data-link-color="#000000"' +
                'href="https://twitter.com/' + this.params.who + '">Tweets by ' + this.params.who + ' </a>' +
                '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>');
        this.log('do_load (height,width)', container_height, container_width);
        $('#' + this.container).empty().append(tag);
        this.log('do_load done', this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('twitter_timeline_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var CONFIG_TITLE = 'Configure Twitter Timeline';

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

        // Who input
        //
        var who_result = config_input( parent_el,
                                       'string',
                                          { text: 'Twitter ID:',
                                            title: "Twitter ID (without leading '@') of a timeline to display",
                                          },
                                          params.who);

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value = function () {
            var config_params = {};
            // station
            config_params.who = who_result.value();

            self.log(widget_id,'returning params:',config_params);

            return config_params;
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 value: value };

    }// end input_twitter_timeline()

    this.log('Instantiated TwitterTimeline',widget_id,params);

}
