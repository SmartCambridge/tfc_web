/* Traffic Map Widget for Twitter Timelines */

/*global $, DEBUG */
/* exported TwitterTimeline */

function TwitterTimeline(widget_id, params) {

    'use strict';

    var DEBUG = ' twitter_timeline_log';

    var CONFIG_SHIM = true;

    var self = this;

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    if (typeof(widget_id) === 'string') {
        self.widget_id = widget_id;
    }
    else {
        // Backwards compatibility
        self.config = widget_id; // widget_id actually contains the 'config' object in legacy mode
        self.widget_id = self.config.container;
        self.config.container_id = self.config.container;
        self.params = params;
    }

    // backwards compatibility init() function
    this.init = function () {
        this.log(self.widget_id, 'Running TwitterTimeline.init');

        this.display(self.config, self.params);

    };

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running TwitterTimeline.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        self.log(self.widget_id, 'Running do_load');
        var container_width = $('#' + self.config.container_id).width(),
            container_height = $('#' + self.config.container_id).height(),
            tag = $('<a class="twitter-timeline" ' +
                'data-lang="en" ' +
                //'data-width="' + container_width + '" ' +
                //'data-height="' + container_height + '" ' +
                'data-dnt="true" ' +
                'data-link-color="#000000"' +
                'href="https://twitter.com/' + self.params.who + '">Tweets by ' + self.params.who + ' </a>' +
                '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>');
        this.log('do_load (height,width)', container_height, container_width);
        $('#' + self.config.container_id).empty().append(tag);
        this.log(self.widget_id, 'do_load done');
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

        var widget_config = new WidgetConfig(config);

        var CONFIG_TITLE = 'Configure Twitter Timeline';

        var config_div = document.getElementById(config.container_id);

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

        var input_result = input_widget(widget_config, config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the StopTimetable parameters
    function input_widget(widget_config, parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Who input
        //
        var who_result = widget_config.input( parent_el,
                                       'string',
                                          { text: 'Twitter ID:',
                                            title: "Twitter ID (without leading '@') of a timeline to display",
                                          },
                                          params.who);

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // station
            config_params.who = who_result.value();

            self.log(self.widget_id,'returning params:',config_params);

            return config_params;
        };

        var config_fn = function () {
            return { title: who_result.value() + " Tweets" };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    }// end input_twitter_timeline()

    this.log(self.widget_id,'Instantiated TwitterTimeline',params);

}
