//
// Bus Stop Chooser
//

var BusStopChooser = (function() {

    'use strict';

    // TODO: Move to smartcambridge.org when available there (#1)
    var STOPS_API_ENDPOINT = 'http://tfc-app4.cl.cam.ac.uk/transport/api/stops';

    var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var OSM_MAX_ZOOM = 19;
    var OSM_ATTRIBUTION = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
    'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a></a>';

    var DEBUG;

    var stop_icon = L.divIcon({
        className: 'bus_stop_chooser_stop',
        iconSize: [20, 40],
        iconAnchor: [2, 38],
        tooltipAnchor: [2, -20],
    });

    var stop_icon_selected = L.divIcon({
        className: 'bus_stop_chooser_stop_selected',
        iconSize: [20, 40],
        iconAnchor: [2, 38],
        tooltipAnchor: [2, -20]
    });


    function debounce(func, wait, immediate) {
        // Debounce a function call
        // https://davidwalsh.name/javascript-debounce-function
        var timeout;
        return function() {
            debug_log("Called wrapped function");
            var context = this, args = arguments;
            var later = function() {
                debug_log("Called later");
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }


    function debug_log() {
        if (DEBUG) {
            var args = [].slice.call(arguments);
            args.unshift('[BusStopChooser]');
            console.log.apply(console, args);
        }
    }


    return {

        create: function(params) {

            var lat = params.lat || 52.204;
            var lng = params.lng || 0.124;
            var zoom = params.zoom || 15;
            var multi_select = params.multi_select || false;
            var zoom_threshold = params.zoom_threshold || 15;

            var map;
            var osm = new L.TileLayer(OSM_TILES,
                { attribution: OSM_ATTRIBUTION,
                  maxZoom: OSM_MAX_ZOOM
                }
            );
            var selected_stops = L.featureGroup();
            var other_stops = L.featureGroup();

            var map_div = document.createElement('div');
            map_div.style.height = "100%";
            map_div.style.width = "100%";
            map_div.style.position = "relative";

            var warning_div = document.createElement('div');
            warning_div.className = 'bus_stop_chooser_warning';
            warning_div.style.display = 'none';

            var spinner_img = document.createElement('div');
            spinner_img.className = 'bus_stop_chooser_spinner';
            spinner_img.style.display = 'none';


            function render(id, current) {
                // Draw chooser into container and let the user interact with it
                var container = id;
                var current_stops = [];
                if (current && current.stops) {
                    current_stops = current.stops.slice();
                }

                if (typeof container === 'string') {
                    container = document.getElementById(container);
                }

                // Catch some annoying problems
                debug_log("width", container.clientWidth, "height", container.clientHeight, (container.clientHeight));
                if ((container.clientWidth < 10) || (container.clientHeight < 10)) {
                    console.warn("BusStopChooser: container has small or zero height or width so may not display");
                }
                debug_log("multi_select", multi_select, "current stops", current_stops);
                if ((!multi_select) && current_stops && current_stops.length > 1) {
                    console.warn("BusStopChooser: got multiple current stops with multi_select=false");
                    console.warn("BusStopChooser: using only the first current stop");
                    current_stops.splice(1);
                }

                container.append(map_div);
                map_div.append(warning_div);
                map_div.append(spinner_img);

                map = new L.Map(container).addLayer(osm);
                selected_stops.addTo(map);
                other_stops.addTo(map);

                // Add any current stops
                if (current_stops.length > 0) {
                    debug_log("Got", current_stops.length, "Initial stops");
                    add_stops(current_stops, true);
                }

                // Set initial view from current.map, else current.stops, else params
                if (current && current.map ) {
                    debug_log("Setting view from current.map");
                    map.setView([current.map.lat, current.map.lng],
                                 current.map.zoom);
                }
                else if (selected_stops.getLayers().length > 0) {
                    debug_log("Setting view from current.stops");
                    var bounds = selected_stops.getBounds().pad(0.2);
                    map.fitBounds(bounds);
                }
                else {
                    debug_log("Setting view from parameters or default");
                    map.setView([lat, lng], zoom);
                }

                debug_log(map.getBounds());

                // Load initial stops and subsequent pan and zoom
                process_pan_and_zoom();
                map.on('moveend', process_pan_and_zoom);

            }


            function getData() {
                // Return data
                debug_log("called getData");
                var stops = [];
                selected_stops.eachLayer(function(marker) {
                    stops.push(marker.properties.stop);
                });
                return {
                    map: {
                        lng: map.getCenter().lng,
                        lat: map.getCenter().lat,
                        zoom: map.getZoom(),
                    },
                    stops: stops,
                };
            }


            function process_pan_and_zoom(e) {
                // Handler for pan and zoom ('moveend') events

                debug_log("Processing pan and zoom, arg", e);
                spinner_img.style.display = 'block';
                if (map.getZoom() < zoom_threshold) {
                    // Remove all non-selected markers, warn user
                    warning_div.innerHTML = 'Zoom in to see bus stops';
                    if (selected_stops.getLayers().length > 0) {
                        warning_div.innerHTML = 'Zoom in to see unselected bus stops';
                    }
                    warning_div.style.display = 'block';
                    other_stops.remove();
                    //other_stops.clearLayers();
                    spinner_img.style.display = 'none';
                }
                else {
                    warning_div.style.display = 'none';
                    other_stops.addTo(map);
                    if (e) {
                        safe_get_bus_stops(function() {
                            spinner_img.style.display = 'none';
                            debug_log('Finished retrieving updated bus stops');
                        });
                    }
                    else {
                        get_bus_stops(function(){
                            spinner_img.style.display = 'none';
                            debug_log('Finished retrieving initial bus stops');
                        });
                    }
                }

            }


            function get_bus_stops(callback, uri, new_stops) {
                // Retrieve stop information from the API

                //debug_log('get_bus_stops, uri', uri, 'new_stops', new_stops);

                if (!uri) {
                    // Build an initial URL (for the first page)
                    var bounds = map.getBounds().pad(0.7).toBBoxString();
                    var qs = '?bounding_box=' + encodeURIComponent(bounds);
                    qs += '&page_size='+encodeURIComponent(50);
                    uri = STOPS_API_ENDPOINT + qs;
                }
                if (!new_stops) {
                    new_stops = [];
                }

                var xhr = new XMLHttpRequest();
                xhr.open('GET', uri, true);
                xhr.send();
                xhr.onreadystatechange = function() {
                    if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                        var api_response = JSON.parse(xhr.responseText);
                        //debug_log('got', api_response.results.length, 'results');
                        new_stops = new_stops.concat(api_response.results);
                        //debug_log('accumulated', new_stops.length, 'results');
                        // Keep going if there are more...
                        if (api_response.next) {
                            get_bus_stops(callback, api_response.next, new_stops);
                        }
                        // Otherwise
                        else {
                            add_stops(new_stops, false);
                            callback();
                        }
                    }
                };

            }

            var safe_get_bus_stops = debounce(get_bus_stops, 750);


            function add_stops(stops, add_selected) {
                // Add new stops, remove any too far off the map

                debug_log("Processing", stops.length, "stops, selected", add_selected);
                var seen_stop_ids = [];

                // Get all the stop_ids we already know about
                var displayed_stop_ids = [];
                selected_stops.eachLayer(function(marker) {
                    displayed_stop_ids.push(marker.properties.stop.stop_id);
                });
                other_stops.eachLayer(function(marker) {
                    displayed_stop_ids.push(marker.properties.stop.stop_id);
                });
                debug_log("Currently displaying", displayed_stop_ids);

                // Add markers for stops we aren't currently displaying
                for (var ctr = 0; ctr < stops.length; ctr++) {

                    var stop = stops[ctr];
                    debug_log("Processing", stop.stop_id);
                    seen_stop_ids.push(stop.stop_id);

                    // Ignore it if it's already displayed
                    if (displayed_stop_ids.indexOf(stop.stop_id) !== -1) {
                        debug_log("Stop", stop.stop_id, "already displayed - ignoring");
                        continue;
                    }

                    //Add 'lng' and 'lat' aliases pending addition to API
                    if (!stop.hasOwnProperty('lng')) stop.lng = stop.longitude;
                    if (!stop.hasOwnProperty('lat')) stop.lat = stop.latitude;

                    debug_log("Adding", stop.stop_id);
                    var marker = L.marker([stop.lat, stop.lng])
                      .bindTooltip(stop.stop_id + ': ' + stop.common_name)
                      .on('click', process_stop_click);
                    marker.properties = { 'stop': stop };
                    if (add_selected) {
                        marker.setIcon(stop_icon_selected).addTo(selected_stops);
                    }
                    else {
                        marker.setIcon(stop_icon).addTo(other_stops);
                    }

                }

                // Delete anything we are displaying that we didn't see
                debug_log("seen_stop_ids", seen_stop_ids);
                other_stops.eachLayer(function(marker) {
                    if (seen_stop_ids.indexOf(marker.properties.stop.stop_id) === -1) {
                        debug_log("Removing", marker.properties.stop.stop_id);
                        other_stops.removeLayer(marker);
                    }
                });

                debug_log("Currently selected_stops", list_selected_stops());

            }


            function process_stop_click(e) {
                // Handler for clicks on stops

                var clicked_marker = e.target;

                var selected = false;
                selected_stops.eachLayer(function(marker) {
                    if (clicked_marker === marker) {
                        selected = true;
                    }
                });
                debug_log("Selected", selected);

                if (selected) {
                    deselect_stop(clicked_marker);
                }
                else {
                    select_stop(clicked_marker);
                }

                debug_log("Currently selected_stops", list_selected_stops());

            }


            function select_stop(marker) {
                // First remove anything currently selected if not multi_select
                // [*should* only ever be one, but who knows?]
                if (!multi_select) {
                    selected_stops.eachLayer(function(m) {
                        deselect_stop(m);
                    });
                }
                other_stops.removeLayer(marker);
                marker.addTo(selected_stops);
                marker.setIcon(stop_icon_selected);
                debug_log("Selected", marker);
            }

            function deselect_stop(marker) {
                selected_stops.removeLayer(marker);
                marker.addTo(other_stops);
                marker.setIcon(stop_icon);
                debug_log("Deselected", marker);
            }

            function list_selected_stops() {
                // Return the stop_ids of currently selected stops
                var codes = [];
                selected_stops.eachLayer(function(marker) {
                    codes.push(marker.properties.stop.stop_id);
                });
                return codes;
            }

            // Return our public methods
            return {
                render: render,
                getData: getData,
            };

        }

    };

}());