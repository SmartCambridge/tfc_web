/* Traffic Map Widget for ACP Lobby Screen */

/*global $, google, document */

function TrafficMap(container, params) {

    'use strict';

    this.container = container;
    this.params = params;
    this.googleliburl = "https://maps.googleapis.com/maps/api/js?key=AIzaSyAEkMI-ZAAt1kjv668jfBXhNB1-odv5m3g";

    this.init = function () {
        this.log("Running init", this.container);
        // Check that the google maps library has been loaded
        if (typeof google == 'undefined') {
            var scripts = document.getElementsByTagName('script');
            for (var i = scripts.length; i--;) {
                if (scripts[i].src == this.googleliburl) {
                    setTimeout(this.init, 500);
                    return;
                }
            }
            var script = document.createElement('script');
            script.onload = this.do_load;
            script.src = this.googleliburl;
            document.head.appendChild(script);
        } else {
            this.do_load();
        }
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log("Running do_load", this.container);
        var map, trafficLayer;
        map = new google.maps.Map(document.getElementById(this.container), {
            zoom: this.params.zoom,
            center: {lat: this.params.lat, lng: this.params.lng},
            disableDefaultUI: true
        });
        trafficLayer = new google.maps.TrafficLayer({
            autoRefresh: true
        });
        trafficLayer.setMap(map);
        this.log("TragfficMap.do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('traffic_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated TrafficMap", container, params);

}
