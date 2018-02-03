/* Traffic Map Widget for Twitter Timelines */

/*global $ */

'use strict';

function TwitterTimeline(container, params) {

    this.container = container;
    this.params = params;

    this.init = function () {
        this.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running TwitterTimeline.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log("Running do_load", this.container);
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
        this.log("do_load (height,width)", container_height, container_width);
        $('#' + this.container).empty().append(tag);
        this.log("do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('twitter_timeline_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated TwitterTimeline", container, params);

}
