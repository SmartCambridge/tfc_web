/* Traffic Map Widget for ACP Lobby Screen */

/*jshint esversion:6 */
/*global google, document, DEBUG */
/*exported TrafficMap */

function TrafficMap(config, params) {

    'use strict';

    this.container = config.container;
    this.params = params;

    this.init = function () {
        log('Running init', config.container);

        var container = document.getElementById(config.container);

        // Empty the container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Backwards compatibility: allow params to be a single stop or
        // to contain a list of stops
        if (!params.maps) {
            log('init - promoting one map to lots of maps');
            params.maps = [params];
        }

        var widget_area = document.createElement('div');
        widget_area.classList.add('traffic_map');
        container.appendChild(widget_area);

        var map_div = document.createElement('div');
        map_div.classList.add('map');
        widget_area.appendChild(map_div);

        // First map settings
        log('init - preping map 0');
        var map0 = params.maps[0];
        var google_map = new google.maps.Map(map_div, {
            zoom: map0.zoom,
            center: {lat: map0.lat, lng: map0.lng},
            disableDefaultUI: true
        });
        var trafficLayer = new google.maps.TrafficLayer({
            autoRefresh: true
        });
        trafficLayer.setMap(google_map);

        // Title
        var title = document.createElement('h1');
        title.classList.add('translucent');
        var img = document.createElement('img');
        img.setAttribute('src', config.static_url + 'car.png');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode('Road Traffic'));
        widget_area.appendChild(title);

        // Ledgend
        var ledgend = document.createElement('div');
        ledgend.classList.add('ledgend');
        ledgend.innerHTML =
           `Live traffic speed<br/><i>Fast</i> <img src="${config.static_url}traffic-legend.png" alt=""/> <i>Slow</i>`;
        widget_area.appendChild(ledgend);

        // Rotation logic
        var map_no = 0;
        if (params.maps.length > 1) {
            var interval = params.interval * 1000 || 7500;
            if (interval < 1000) {
                interval = 1000;
            }
            log('do load - interval is', interval);
            window.setInterval(function() {
                map_no = (map_no + 1) % params.maps.length;
                log('TrafficMap - rolling maps to map number', map_no);
                google_map.panTo({lat: params.maps[map_no].lat, lng: params.maps[map_no].lng});
                google_map.setZoom(params.maps[map_no].zoom);
            }, interval);
        }
        else {
            log('init - only one map');
        }

        log('TragfficMap.init done', this.container);

    };

    function log() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('traffic_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    }

    log('Instantiated TrafficMap', this.container, params);

}
