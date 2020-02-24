// Javascript functions for displaying Bluetruth data

/* eslint-env es6 */
/* eslint no-console: "off" */
/*global $, L, API_TOKEN */

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
var HIGHLIGHT_LINE = { weight: 10, offset: -6 };

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
    layer_control,                  // The layer control
    clock,                          // The clock control
    spinner,                        // The loading spinner
    hilighted_line,                 // The currently highlighted link or route
    speed_display = 'actual',       // Line colour mode - 'actual', 'normal' or 'relative'
    site_index = {},                // Lookup API site id to Leaflet marker
    link_index = {},                // Lookup API link/route id to Leaflet polyline
    first_time = true;              // First time loading the data?

// Initialise
$(document).ready(function () {

    setup_map();
    load_data();

});

// Setup the map environment
function setup_map() {

    // Various feature layers
    sites_layer = L.featureGroup();
    links_layer = L.featureGroup();
    routes_layer = L.featureGroup();

    // Various map providers
    var osm = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    });

    map = L.map('map', {zoomControl: false});

    // Map legend
    get_legend().addTo(map);

    // Layer control
    var base_layers = {
    };
    var overlay_layers = {
        'Sites': sites_layer,
        'All point-to-point links': links_layer,
    };
    layer_control = L.control.layers(base_layers, overlay_layers, {collapsed: true}).addTo(map);

    //  Zoom control (with non-default position)
    L.control.zoom({position: 'topright'}).addTo(map);

    // Clock
    clock = get_clock().addTo(map);

    // Handler to clear any highlighting caused by clicking lines
    map.on('click', clear_line_highlight);

    // Centre on Cambridge and add default layers
    var cambridge = new L.LatLng(52.20038, 0.1197);
    map.setView(cambridge, 12).addLayer(osm).addLayer(sites_layer).addLayer(links_layer);

    spinner = document.createElement('div');
    spinner.className = 'spinner';
    document.getElementById('map').appendChild(spinner);

}


// Async load data, display it and reschedule
function load_data() {

    var headers = {
        Authorization: 'Token ' + API_TOKEN
    };

    $.when(
        $.get({
            url: '/api/v1/traffic/btjourney/site/',
            headers: headers,
            dataType: 'json',
        }),
        $.get({
            url: '/api/v1/traffic/btjourney/link/',
            headers: headers,
            dataType: 'json',
        }),
        $.get({
            url: '/api/v1/traffic/btjourney/route/',
            headers: headers,
            dataType: 'json',
        }),
        $.get({
            url: '/api/v1/traffic/btjourney/latest/',
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

            // Display the data's timestamp on the clock
            var timestamp = journey_response[0].ts * 1000;
            clock.update(new Date(timestamp));

            if (first_time) {
                // Scale map to fit
                var region = sites_layer.getBounds().extend(links_layer);
                map.fitBounds(region);

                // Cancel the spinner
                spinner.style.display = 'none';

                first_time = false;
            }

            // The underlying API updates journey times every 5 minutes.
            // Schedule an update 5 and-a-bit minutes from the last
            // timestamp if that looks believable, and in a minute
            // otherwise.
            var now = Date.now();
            var delta = timestamp - now + (5.25*60000);
            if (delta <= 0 || delta > 10*60000) {
                delta = 60000;
            }
            console.log('Timestamp was ' + new Date(timestamp));
            console.log('Delta is ' + delta);
            console.log('Now is ' + new Date(now));
            console.log('Next at ' + new Date(now + delta));
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
                .bindPopup(site_popup, {maxWidth: 500})
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
            .bindPopup(line_popup, {maxWidth: 500})
            .on('click', line_highlight)
            .addTo(layer);
        line.properties = { 'link': link };

        // Remember the polyline for the future
        link_index[link_id] = line;

        // Add routes to the map individually, because they can overlap each other
        if (layer === routes_layer) {
            layer_control.addOverlay(line, link.name);
        }
    }

    return line;

}

// Set line colours based on corresponding journey's travelTime and
// normalTravelTime
function update_line_colours() {

    for (var id in link_index) {
        if (link_index.hasOwnProperty(id)) {
            var line = link_index[id];

            if (speed_display === 'relative') {
                update_relative_speed(line);
            }
            else {
                update_actual_normal_speed(line);
            }
        }
    }
}


// Set line colour based on travel time (aka speed) compared to normal
function update_relative_speed(line) {

    var journey = line.properties.journey;
    var choice;
    // Missing
    if (!journey.travelTime) {
        choice = BROKEN_COLOUR;
    }
    // Worse than normal
    else if (journey.travelTime > 1.2*journey.normalTravelTime) {
        choice = SLOW_COLOUR;
    }
    // Better then normal
    else if (journey.travelTime < 0.8*journey.normalTravelTime) {
        choice = FAST_COLOUR;
    }
    // Normal(ish)
    else {
        choice = NORMAL_COLOUR;
    }
    line.setStyle({color: choice});

}

// Set line colour based on actual or expected speed
function update_actual_normal_speed(line) {

    var journey = line.properties.journey;
    var link = line.properties.link;
    var time = speed_display === 'actual' ? journey.travelTime : journey.normalTravelTime;
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

// Hilight a clicked line
function line_highlight(e) {

    var line = e.target;

    clear_line_highlight();
    line.setStyle(HIGHLIGHT_LINE)
        .setOffset(HIGHLIGHT_LINE.offset);
    hilighted_line = line;
}


// Clear any line highlight
function clear_line_highlight() {

    if (hilighted_line) {
        hilighted_line.setStyle(NORMAL_LINE)
            .setOffset(NORMAL_LINE.offset);
        hilighted_line  = null;
    }

}


// Handle site popups
function site_popup(marker) {

    var site = marker.properties.site;

    return '<div class="popuphead">Sensor site</div>' +
           '<table>' +
           `<tr><th>Name</th><td>${site.name}</td></tr>` +
           `<tr><th>Description</th><td>${site.description}</td></tr>` +
           `<tr><th>Id</th><td>${site.id}</td></tr>` +
           `<tr><th>latitude</th><td>${site.location.lat}</td></tr>` +
           `<tr><th>Longitude</th><td>${site.location.lng}</td></tr>` +
           '</table>';

}


// Handle line popups
function line_popup(polyline) {

    var link = polyline.properties.link;
    var journey = polyline.properties.journey;

    var message = '<div class="popuphead">Link</div>' +
                  '<table>' +
                  `<tr><th>Name</th><td>${link.name}</td></tr>` +
                  `<tr><th>Description</th><td>${link.description}</td></tr>` +
                  `<tr><th>Id</th><td>${link.id}</td></tr>` +
                  `<tr><th>Length</th><td>${link.length} m</td></tr>` +
                  '</table>';

    if (journey) {
        message += '<div class="popuphead">Journey</div>' +
                   '<table>' +
                   `<tr><th>Observation time</th><td>${journey.time} </dt></tr>` +
                   `<tr><th>Observation period</th><td>${journey.period} s</td></tr>`;
        if (journey.travelTime) {
            var speed = (link.length / journey.travelTime) * TO_MPH;
            message += `<tr><th>Travel Time</th><td>${journey.travelTime.toFixed(0)}s (${speed.toFixed(1)} mph)</td></tr>`;
        }
        if (journey.normalTravelTime) {
            var normal_speed = (link.length / journey.normalTravelTime) * TO_MPH;
            message += `<tr><th>Normal Travel Time</th><td>${journey.normalTravelTime.toFixed(0)}s (${normal_speed.toFixed(1)} mph)</td></tr>`;
        }
    }

    message += '</table>' +
               `<p><a href="../plot/${escape(link.id)}">Journey time plot</a></p>`;

    return message;

}

function get_clock() {
    var control = L.control({position: 'topleft'});
    control.onAdd = function () {
        var div = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control-layers-expanded clock');
        div.innerHTML = 'Loading...';
        return div;
    };
    control.update = function(datetime) {
        var hh = ('0'+datetime.getHours()).slice(-2);
        var mm = ('0'+datetime.getMinutes()).slice(-2);
        var now  = new Date();
        // If datetime is today
        if (datetime.toDateString() === now.toDateString()) {
            control.getContainer().innerHTML = 'Updated '+hh+':'+mm;
        }
        else {
            var d = datetime.toISOString().slice(0, 10);
            control.getContainer().innerHTML = 'Updated ' + hh + ':' + mm + ' on ' + d;
        }

    };
    return control;
}

// Legend management
function get_legend() {
    var legend = L.control({position: 'bottomleft'});
    legend.onAdd = function () {
        var div = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control-layers-expanded ledgend');
        add_button(div, 'actual', 'Actual speed');
        add_button(div, 'normal', 'Normal speed');
        add_button(div, 'relative', 'Speed relative to normal');
        var key = L.DomUtil.create('div', 'ledgend-key', div);
        key.id = 'ledgend-key';
        set_ledgend_key(key);
        return div;
    };
    return legend;
}

function add_button(parent, value, html) {
    var label = L.DomUtil.create('label', 'ledgend-label', parent);
    var button = L.DomUtil.create('input', 'ledgend-button', label);
    button.type = 'radio';
    button.name = 'display_type';
    button.value = value;
    if (speed_display === value) {
        button.checked = 'checked';
    }
    var span = L.DomUtil.create('span', 'ledgend-button-text', label);
    span.innerHTML = html;
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, 'click', display_select,  button);
}

function display_select() {
    speed_display = this.value;
    set_ledgend_key(document.getElementById('ledgend-key'));
    update_line_colours();
}

function set_ledgend_key(element) {
    var colours;
    if (speed_display === 'relative') {
        colours =
            `<span style="color: ${FAST_COLOUR}">GREEN</span>: speed is at least 20% above normal<br>` +
            `<span style="color: ${NORMAL_COLOUR}">BLUE</span>: speed close to normal<br>` +
            `<span style="color: ${SLOW_COLOUR}">RED</span>: speed is at least 20% below normal<br>` +
            `<span style="color: ${BROKEN_COLOUR}">GREY</span>: no speed reported<br>` +
            '<span></span><br>';
    }
    else {
        colours =
            `<span style="color: ${FAST_COLOUR}">GREEN</span>: above 20 mph<br>` +
            `<span style="color: ${MEDIUM_COLOUR}">AMBER</span>: between 10 and 20 mph<br>` +
            `<span style="color: ${SLOW_COLOUR}">RED</span>: between 5 and 10 mph<br>` +
            `<span style="color: ${VERY_SLOW_COLOUR}">DARK RED</span>: below 5 mph <br>` +
            `<span style="color: ${BROKEN_COLOUR}">GREY</span>: no speed reported<br>`;
    }
    element.innerHTML = '<div class="ledgend-colours">' + colours + '</div>' +
        '<div class="ledgend-common">Traffic drives on the left. Updates every 5m.</div>';
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
