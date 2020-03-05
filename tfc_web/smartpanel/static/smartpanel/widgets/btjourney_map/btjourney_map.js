/* Traffic Map Widget for ACP Lobby Screen */

/*jshint esversion:6 */
/* eslint-env es6 */
/* eslint no-console: "off" */
/*global $, L, document, WidgetConfig, DEBUG */
/*exported BtjourneyMap */

function BtjourneyMap(widget_id) {

    'use strict';

    var self = this;

    // m/sec to mph
    var TO_MPH = 2.23694;

    // Style options for markers and lines
    var SITE_OPTIONS = {
        color: 'black',
        fillColor: 'green',
        fill: true,
        fillOpacity: 0.8,
        radius: 7,
        pane: 'markerPane'
    };

    var NORMAL_LINE = { weight: 5, offset: -3 };

    var NORMAL_COLOUR = '#3388ff';
    var VERY_SLOW_COLOUR = '#9a111a';
    var SLOW_COLOUR = '#e00018';
    var MEDIUM_COLOUR = '#eb7F1b';
    var FAST_COLOUR = '#85cd50';
    var BROKEN_COLOUR = '#b0b0b0';

    // Script state globals
    var map,                            // The Leaflet map object itself
        sites_layer,                    // layer containing the sensor sites
        links_layer,                    // Layer containing the point to point links
        routes_layer,                   // Layer containing the compound routes
        site_index = {},                // Lookup API site id to Leaflet marker
        link_index = {};                // Lookup API link/route id to Leaflet polyline


    this.display = function (config, params) {
        self.log(widget_id, 'Running display', config.container_id);

        self.config = config;

        self.params = params;

        var container = document.getElementById(config.container_id);

        // Empty the container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var widget_area = document.createElement('div');
        widget_area.classList.add('bt_journey_map');
        container.appendChild(widget_area);

        var map_div = document.createElement('div');
        map_div.classList.add('map');
        widget_area.appendChild(map_div);

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
        ledgend.appendChild(document.createTextNode('Live traffic speed'));
        ledgend.appendChild(document.createElement('br'));
        var fast = document.createElement('i');
        fast.appendChild(document.createTextNode('Fast '));
        ledgend.appendChild(fast);
        var img2 = document.createElement('img');
        img2.setAttribute('src', config.static_url + 'traffic-legend.png');
        ledgend.appendChild(img2);
        var slow = document.createElement('i');
        slow.appendChild(document.createTextNode(' Slow'));
        ledgend.appendChild(slow);
        widget_area.appendChild(ledgend);

        setup_map(map_div);
        load_data();

        self.log(widget_id, 'BTJourneyMap.display done');

    };

    self.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('bt_journey_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    // Setup the map environment
    function setup_map(map_div) {

        // Various feature layers
        sites_layer = L.featureGroup();
        links_layer = L.featureGroup();
        routes_layer = L.featureGroup();

        // Various map providers
        var osm = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        });

        map = L.map(map_div, {zoomControl: false});

        // Setup map and add default layers
        map.setView(
            [self.params.map.lat, self.params.map.lng], self.params.map.zoom)
            .addLayer(osm).addLayer(sites_layer);

        if (self.params.show_routes === 'true') {
            map.addLayer(routes_layer);
        }
        else {
            map.addLayer(links_layer);
        }

    }

    // Async load data, display it and reschedule
    function load_data() {

        var headers = {
            Authorization: 'Token ' + self.config.settings.SMARTPANEL_API_TOKEN
        };

        $.when(
            $.get({
                url: self.config.settings.SMARTPANEL_API_ENDPOINT + 'traffic/btjourney/site/',
                headers: headers,
                dataType: 'json',
            }),
            $.get({
                url: self.config.settings.SMARTPANEL_API_ENDPOINT + 'traffic/btjourney/link/',
                headers: headers,
                dataType: 'json',
            }),
            $.get({
                url: self.config.settings.SMARTPANEL_API_ENDPOINT + 'traffic/btjourney/route/',
                headers: headers,
                dataType: 'json',
            }),
            $.get({
                url: self.config.settings.SMARTPANEL_API_ENDPOINT + 'traffic/btjourney/latest/',
                headers: headers,
                dataType: 'json',
            })
        )
            .done(function(site_response, link_response, route_response, journey_response) {

                var sites = site_response[0].site_list;
                var links = link_response[0].link_list.concat(route_response[0].route_list);
                var journeys = journey_response[0].request_data;

                draw_sites(sites);
                process_journeys(journeys, links, sites);

                // The underlying API updates journey times every 5 minutes.
                // Schedule an update 5 and-a-bit minutes from the last
                // timestamp if that looks believable, and in a minute
                // otherwise.
                var timestamp = journey_response[0].ts * 1000;
                var now = Date.now();
                var delta = timestamp - now + (5.25*60000);
                if (delta <= 0 || delta > 10*60000) {
                    delta = 60000;
                }
                setTimeout(load_data, delta);

            })

            // If anything went wrong, try again in a minute
            .fail(function(){
                console.log('API call failed - default reschedule');
                setTimeout(load_data, 60000);
            });

    }


    // Helper function to sync drawn sites
    function draw_sites(sites) {

        // Add markers for new sites
        for (var i = 0; i < sites.length; ++i) {
            var site = sites[i];

            if (site_index[site.id] === undefined) {
                var marker = L.circleMarker([site.location.lat, site.location.lng], SITE_OPTIONS)
                    .addTo(sites_layer);
                marker.properties = { 'site': site };
                site_index[site.id] = marker;
            }

        }

        // Remove markers for sites that have gone away
        for (var site_id in site_index) {
            if (find_object(sites, site_id) === undefined) {
                site_index[site_id].delete();
                delete site_index[site.id];
            }
        }

    }

    // Process each journey, add/remove links from the map and colour them
    function process_journeys(journeys, links, sites) {

        for (var i = 0; i < journeys.length; ++i) {
            var journey = journeys[i];

            // Try to get the Leaflet polyline for the coresponding route
            var line = link_index[journey.id];

            // Add a polyline to the map if missing
            if (line === undefined) {
                line = draw_line(journey.id, links, sites);
            }

            // The addition could have failed
            if (line !== undefined) {
                line.properties.journey = journey;
            }

        }

        // Remove polylines for links without journeys
        for (var link_id in link_index) {
            if (find_object(journeys, link_id) === undefined) {
                link_index[link_id].delete();
                delete link_index[link_id];
            }
        }

        update_line_colours();

    }

    // Helper function to draw links and routes
    function draw_line(link_id, links, sites) {

        var line = undefined;
        var link = find_object(links, link_id);

        if (link === undefined) {
            console.log('Can\'t find link with id ' + link_id);
        }
        else {
            var layer = link.sites.length <= 2 ? links_layer : routes_layer;

            // Accumulate points
            var points = [];
            for (var j = 0; j < link.sites.length; ++j) {
                var site = find_object(sites, link.sites[j]);
                if (site) {
                    points.push([site.location.lat, site.location.lng]);
                }
            }

            line = L.polyline(points, NORMAL_LINE)
                .setStyle({color: NORMAL_COLOUR})
                .addTo(layer);
            line.properties = { 'link': link };

            // Remember the polyline for the future
            link_index[link_id] = line;

        }

        return line;

    }

    // Set line colours based on corresponding journey's travelTime and
    // normalTravelTime
    function update_line_colours() {

        for (var id in link_index) {
            if (link_index.hasOwnProperty(id)) {
                var line = link_index[id];
                update_actual_speed(line);
            }
        }
    }


    // Set line colour based on actual or expected speed
    function update_actual_speed(line) {

        var journey = line.properties.journey;
        var link = line.properties.link;
        var time = journey.travelTime;
        var speed = (link.length / time) * TO_MPH;
        var choice;
        if (time === null) {
            choice = BROKEN_COLOUR;
        }
        else if (speed < 5) {
            choice = VERY_SLOW_COLOUR;
        }
        else if (speed < 10) {
            choice = SLOW_COLOUR;
        }
        else if (speed < 20) {
            choice = MEDIUM_COLOUR;
        }
        else {
            choice = FAST_COLOUR;
        }
        line.setStyle({color: choice});
    }

    // Find an object from a list of objects by matching each object's 'id'
    // attribute with the supplied 'id'. Could build/use lookup tables instead?
    function find_object(list, id) {

        for (var i = 0; i < list.length; ++i) {
            var object = list[i];
            if (object.id === id) {
                return object;
            }
        }
        console.log('Failed to find object with id ', id);
        return undefined;
    }


    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var widget_config = new WidgetConfig(config);

        self.log(widget_id, 'BT TrafficMap configuring widget with', config, params);

        self.config = config;

        var config_div = document.getElementById(config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
            config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        //
        var config_title = document.createElement('h1');
        config_title.innerHTML = 'Configure BT Traffic Map';
        config_div.appendChild(config_title);

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = 'You can create a map displaying bluetooth-monitored ' +
            ' journey times using this panel widget.';
        config_info1.appendChild(document.createTextNode(config_info_text));
        config_div.appendChild(config_info1);

        var config_info2 = document.createElement('p');
        config_info2.innerHTML = 'You can choose the area to display, ' +
            'but we only have data for Cambridge city (see ' +
            '<a href="https://smartcambridge.org/traffic/btjourney/map/">https://smartcambridge.org/traffic/btjourney/map/</a>' +
            'for the area covered).';
        config_div.appendChild(config_info2);

        var config_info3 = document.createElement('p');
        config_info_text = 'You can choose to display either information on point-to-point ' +
           'links between sensor stations, or on a number of longer routes within the city';
        config_info3.appendChild(document.createTextNode(config_info_text));
        config_div.appendChild(config_info3);

        var config_form = document.createElement('form');
        config_div.appendChild(config_form);

        var config_table = document.createElement('table');
        config_table.className = 'config_input_traffic_map';

        var config_tbody = document.createElement('tbody');

        config_table.appendChild(config_tbody);
        config_form.appendChild(config_table);

        // MAP
        self.log('configure() calling widget_config.input', 'with', params.map);
        var btjourney_map_result = widget_config.input(config_tbody, 'leaflet_map',
            { text: 'Map:', title: 'Select the area to display', zoom: 12 },
            { map: params.map });

        // LINKS OR ROUTES
        //
        var routes_result = widget_config.input( config_tbody,
            'select',
            {
                text: 'Display:',
                title: 'Choose if you want to display point-to-point links, or longer routes',
                options: [
                    { value: 'false', text: 'Point-to-point links' },
                    { value: 'true', text: 'Longer routes' }
                ]
            },
            params.show_routes || 'false');


        //debug
        // return a test set of maps
        return {
            valid: function () { return true; },
            value: function () { return {
                show_routes: routes_result.value(),
                map: btjourney_map_result.value().map
            }; },
            config: function () { return { title: 'Cambs BT Traffic Maps' }; }
        };
    }; // end this.configure

    self.log(widget_id, 'Instantiated TrafficMap');

}

