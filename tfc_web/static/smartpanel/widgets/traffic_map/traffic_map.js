/* Traffic Map Widget for ACP Lobby Screen */

/*jshint esversion:6 */
/*global google, document, DEBUG */
/*exported TrafficMap */

function TrafficMap(widget_id) {

    'use strict';

    var self = this;

    var DEBUG = ' traffic_map_log';

    this.display = function (config, params) {
        self.log(widget_id,'Running display', config.container_id);

        self.config = config;

        self.params = params;

        var container = document.getElementById(config.container_id);

        // Empty the container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var widget_area = document.createElement('div');
        widget_area.classList.add('traffic_map');
        container.appendChild(widget_area);

        var map_div = document.createElement('div');
        map_div.classList.add('map');
        widget_area.appendChild(map_div);

        // First map settings
        self.log(widget_id,'init - prepping map 0');
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

        // Rotation logic
        var map_no = 0;
        if (params.maps.length > 1) {
            var interval = params.interval * 1000 || 7500;
            if (interval < 1000) {
                interval = 1000;
            }
            self.log('do load - interval is', interval);
            window.setInterval(function() {
                map_no = (map_no + 1) % params.maps.length;
                self.log(widget_id,'TrafficMap - rolling maps to map number', map_no);
                google_map.panTo({lat: params.maps[map_no].lat, lng: params.maps[map_no].lng});
                google_map.setZoom(params.maps[map_no].zoom);
            }, interval);
        }
        else {
            self.log(widget_id,'display - only one map');
        }

        self.log(widget_id,'TrafficMap.display done');

    };

    self.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('traffic_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var widget_config = new WidgetConfig(config);

        self.log(widget_id,'TrafficMap configuring widget with', config, params);

        //debug we need to plan for config.width and height

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
        config_title.innerHTML = 'Configure Traffic Map';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');
        config_div.appendChild(config_form);

        /*
        var input_result = input_stop_timetable(widget_config,
                                                config_form,
                                                (params && params.title) ? params : PARAMS_DEFAULT);
        */
        var config_table = document.createElement('table');
        config_table.className = 'config_input_traffic_map';

        var config_tbody = document.createElement('tbody');

        config_table.appendChild(config_tbody);
        config_form.appendChild(config_table);

        // Interval (optional)
        //
        var interval_result = widget_config.input( config_tbody,
                                         'number',
                                         { text: 'Interval (s) between maps<br/>(optional):',
                                           title: 'If you choose multiple maps, then each will be displayed this long (in seconds)'
                                         },
                                         params.interval);

        var maps_result = input_google_map_list( widget_config, config_tbody, params.maps );


        //debug
        // return a test set of maps
        return { valid: function () { return true; },
                 value: function () { return { interval: interval_result.value(),
                                               maps: maps_result.value()
                                               /*
                                               maps: [
                                                       { lat: 52.204684, lng: 0.124622, zoom: 12 },
                                                       { lat: 52.204684, lng: 0.124622, zoom: 10 }
                                                     ]
                                               */
                                             };
                                    },
                 config: function () { return { title: 'Cambs Traffic Maps' }; }
               };
    }; // end this.configure

    // Add a 'maps' input to the main config table
    // parent_el is assumed to be a tbody, to which this fn appends a <tr>
    function input_google_map_list(widget_config, parent_el, current_maps) {
        self.log(widget_id,'input_map_list called with', current_maps);
        var row = document.createElement('tr');
        parent_el.appendChild(row);

        // create TD to hold 'name' prompt for field
        var td_name = document.createElement('td');
        td_name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = 'Configure one or more maps';
        label.appendChild(document.createTextNode('Traffic Maps:'));
        td_name.appendChild(label);
        row.appendChild(td_name);

        // create TD to hold 'value' destination_list
        var td_value = document.createElement('td');
        td_value.className = 'widget_config_property_value';
        row.appendChild(td_value);

        var maps_table = document.createElement('table');
        maps_table.className = 'config_traffic_maps_table';
        maps_table.style['border-collapse'] = 'separate';
        maps_table.style['padding'] = '5px';
        td_value.appendChild(maps_table);

        var tbody = document.createElement('tbody');
        maps_table.appendChild(tbody);

        var map_values = [];

        if (current_maps) {
            for (var i=0; i<current_maps.length; i++) {
                var map = current_maps[i];

                map_values.push(input_google_map(widget_config, tbody, map));
            }
        } else {
            map_values.push(input_google_map(widget_config, tbody, null));
        }


        // create (+) add an element button
        var plus_url = self.config.static_url + 'images/plus.png';
        var plus_img = document.createElement('img');
        plus_img.setAttribute('src', plus_url);
        plus_img.setAttribute('alt', 'Add');
        plus_img.setAttribute('title', 'Add another map');
        plus_img.className = 'widget_config_plus';
        // now set the onlclick callback for the (+) button to add another destination input element
        var plus_onclick = function () {
            self.log(widget_id,'TrafficMap input_map_list plus_onclick called');
            map_values.push(input_google_map(widget_config, tbody,null));
        }
        plus_img.onclick = plus_onclick;

        td_value.appendChild(plus_img);



        function value_fn () {
            var list_result = [];
            for (var i=0; i<map_values.length; i++) {
                if (map_values[i].value()) {
                    list_result.push(map_values[i].value());
                }
            }

            return list_result;
        };

        return { value: value_fn,
                 valid: function () { return true; },
                 element: row
               };

    } // end input_google_map_list

    // Here is where we prompt for and configure an actual map.
    // Currently we are experimenting with the map 'inline' on the config widget, and
    // also with 'chooser' to make the config widget more compact.
    //
    // Add a 'google_map' input (as a row in a 'maps' table)
    function input_google_map(widget_config, parent_el, current_map) {
        self.log(widget_id,'input_google_map called with',current_map);
        //return input_google_map_inline(widget_config, parent_el, current_map);
        return input_google_map_chooser(widget_config, parent_el, current_map);
    }

    // Add a 'google_map' input (as a row in a 'maps' table), displaying the map 'inline'
    function input_google_map_inline(widget_config, parent_el, current_map) {
        self.log(widget_id,'input_google_map_inline called with',current_map);

        var tr = document.createElement('tr');
        parent_el.appendChild(tr);

        var td = document.createElement('td');
        td.className = 'widget_config_repeating_element';
        tr.appendChild(td);

        // create (x) delete this element button
        var x_url = self.config.static_url + 'images/x.png';
        var x_img = document.createElement('img');
        x_img.setAttribute('src', x_url);
        x_img.setAttribute('alt', 'Delete');
        x_img.setAttribute('title', 'Delete this map');
        x_img.className= 'widget_config_x';
        // add onclick fn to remove this input
        //
        var removed = false;

        var x_onclick = function () {
            self.log('x_onclick called');
            removed = true;
            tr.remove();
        }
        x_img.onclick = x_onclick;

        td.appendChild(x_img);

        var table = document.createElement('table');
        td.appendChild(table);
        var tbody = document.createElement('tbody');
        table.appendChild(tbody);

        var map_result = widget_config.input( tbody,
                                                'google_map',
                                                { text: '',
                                                  title: 'Configure a map position and zoom',
                                                  show_traffic: true
                                                },
                                                { map: current_map } );

        function value_fn() {
            if (removed) {
                return null;
            } else {
                //debug maybe no map selected?
                var map = map_result.value().map;
                self.log(widget_id,'traffic_map','input_google_map','returning',map);
                return map_result.value().map;
            }
        }

        return { value: value_fn,
                 valid: function () { return true; }
               };
    }

    // Add a 'google_map' input (as a row in a 'maps' table), displaying the map 'inline'
    function input_google_map_chooser(widget_config, parent_el, current_map) {
        self.log('input_google_map_chooser called with', current_map);

        var tr = document.createElement('tr');
        parent_el.appendChild(tr);

        var td = document.createElement('td');
        td.className = 'widget_config_repeating_element';
        tr.appendChild(td);

        // create (x) delete this element button
        var x_url = self.config.static_url + 'images/x.png';
        var x_img = document.createElement('img');
        x_img.setAttribute('src', x_url);
        x_img.setAttribute('alt', 'Delete');
        x_img.setAttribute('title', 'Delete this map');
        x_img.className= 'widget_config_x';
        // add onclick fn to remove this input
        //
        var removed = false;

        var x_onclick = function () {
            self.log('x_onclick called');
            removed = true;
            tr.remove();
        }
        x_img.onclick = x_onclick;

        td.appendChild(x_img);

        var table = document.createElement('table');
        td.appendChild(table);
        var tbody = document.createElement('tbody');
        table.appendChild(tbody);

        var map_result = widget_config.input( tbody,
                                                'google_map_with_chooser',
                                                { text: '',
                                                  title: 'Configure a map position and zoom',
                                                  show_traffic: true
                                                },
                                                { map: current_map } );

        function value_fn() {
            if (removed) {
                return null;
            } else {
                //debug maybe no map selected?
                var map = map_result.value().map;
                self.log(widget_id,'traffic_map','input_google_map','returning',map);
                return map_result.value().map;
            }
        }

        return { value: value_fn,
                 valid: function () { return true; }
               };
    }

    self.log(widget_id, 'Instantiated TrafficMap');

}

