

    // ************************************************************************************
    // *****************  Library Widget Configuration ************************************
    // ************************************************************************************
    //
    // THESE ARE GENERAL PURPOSE CONFIG INPUT FUNCTIONS, should be in common widget.js
    //
    // config_input will append a <tr> to the parent object 'parent_el'
    // and add an entry to the global dictionary:
    // config_inputs[param_name] = { type: param_type,
    //                               options: param_options,
    //                               value: a function that returns the value }
    //
    // config_input(
    //   parent_el:     DOM object to append input element (tbody)
    //   param_type:    'select' | 'string' | 'number'
    //   param_options: options needed for each input type
    //   param_current: current value of property (for edit)
    //   )
    // 'select': { text: text display before dropdown
    //             title: helper text
    //             options: [ { value: <key>, text: <displayname> } ... ]
    //            }
    //
    // 'string':  { text:
    //              title:
    //            });
    //
    // 'number':  { text:
    //              title:
    //              step: 'any' *[OPTIONAL]
    //            });
    //
    //
    var CONFIG_COLOR = '#ffffe6';

    function config_input(parent_el, param_type, param_options, param_current) {
        //self.log('creating input', param_name, param_type, param_options, param_current);
        var input_info = null; // info to return, .value() = data callback
        switch (param_type) {
            case 'select':
                input_info = config_select(parent_el, param_options, param_current);
                break;

            case 'string':
                input_info = config_string(parent_el, param_options, param_current);
                break;

            case 'number':
                input_info = config_number(parent_el, param_options, param_current);
                break;

            case 'bus_stops':
                input_info = config_bus_stops(parent_el, param_options, param_current);
                break;

            case 'leaflet_map':
                input_info = config_leaflet_map(parent_el, param_options, param_current);
                break;

            case 'google_map':
                input_info = config_google_map(parent_el, param_options, param_current);
                break;

            case 'area':
                input_info = config_area(parent_el, param_options, param_current);
                break;

            default:
                input_info = null;
                //self.log(widget_id, 'bad param_type in config_input', param_type);
        }

        return input_info;
    }

    // Append a row containing <td>TITLE</td><td>SELECT</td>
    function config_select(parent_el, param_options, param_current) {
        //var id = config_id + '_' + param_name;
        var row = document.createElement('tr');

        // create td to hold 'name' prompt for field
        var td_name = document.createElement('td');
        td_name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = param_options.title;
        label.appendChild(document.createTextNode(param_options.text));
        td_name.appendChild(label);
        row.appendChild(td_name);

        // create td to hold select dropdown
        var td_select = document.createElement('td');
        td_select.className = 'widget_config_property_value';
        var sel = document.createElement('select');

        // set select.title
        if (param_options.title) sel.title = param_options.title;

        // set select.onchange
        if (param_options.onchange) {
            sel.onchange = function () { param_options.onchange({ value: this.value,
                                                                  parent: parent_el
                                                                }); } ;
        }

        // set the select dropdown options
        var select_options = param_options.options;
        for (var i=0; i<select_options.length; i++) {
            var opt = document.createElement('option');
            opt.value = select_options[i].value;
            opt.text = select_options[i].text;
            sel.appendChild(opt);
        }

        // set default value of input to value provided in param_current
        // include support for format: 'boolean'
        if (param_options.format == 'boolean') {
            sel.value = param_current ? 'true' : 'false';
        } else {
            sel.value = param_current;
        }

        td_select.appendChild(sel);
        row.appendChild(td_select);

        parent_el.appendChild(row);

        var value = function () {
            // return sel.value, including support for format: 'boolean'
            if (param_options.format == 'boolean') {
                return sel.value == 'true';
            }
            return sel.value;
        }

        return { value: value,
                 valid: function () { return true; }
               };
    }

    function config_number(parent_el, param_options, param_current) {
        if (!param_options.type) param_options.type = 'number';
        return config_string(parent_el, param_options, param_current);
    }

    //  Append a table row with a simple input field
    //  By default this will be 'input type='text'
    //  If param_options has 'format: 'textarea' then a textarea will be used
    //
    function config_string(parent_el, param_options, param_current)
    {
        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field
        var td_name = document.createElement('td');
        td_name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = param_options.title;
        label.appendChild(document.createTextNode(param_options.text));
        td_name.appendChild(label);
        row.appendChild(td_name);
        var td_value = document.createElement('td');
        td_value.className = 'widget_config_property_value';

        var input;

        var format = param_options.format ? param_options.format : 'text';

        switch (format) {
            case 'textarea':
                 input = document.createElement('textarea');
                 break;

            default:
                 input = document.createElement('input');
                 break;
        }

        if (param_options.type) input.type = param_options.type;
        if (param_options.step) input.step = param_options.step;
        if (param_options.title) input.title = param_options.title;

        // set default value of input to value provided in param_current
        //self.log(param_name,'default set to',param_current);
        if (param_current) input.value = param_current;

        td_value.appendChild(input);
        row.appendChild(td_value);

        parent_el.appendChild(row);

        return { value: function() { return input.value; },
                 valid: function () { return true; }
            };
    }

    // populate a table row with a bus stop input widget
    function config_bus_stops(parent_el, param_options, param_current)
    {

        'use strict';

        console.log('Called config_bus_stops');

        var title = param_options.title;
        var text = param_options.text;
        var width = param_options.width || "500px";
        var height = param_options.height || "500px";

        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field

        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        name.appendChild(label);
        row.appendChild(name);

        var value = document.createElement('td');
        value.className = 'widget_config_property_value';
        value.style.height = height;
        value.style.width = width;
        row.appendChild(value);

        parent_el.appendChild(row);

        var chooser = BusStopChooser.create(param_options);
        chooser.render(value, param_current);

        return {
            value: chooser.getData,
            valid: function () { return true; }
        };

    }

    // populate a table row with a Leaflet map input widget
    function config_leaflet_map(parent_el, param_options, param_current)
    {

        'use strict';

        console.log('Called config_leflet_map');

        var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        var OSM_MAX_ZOOM = 19;
        var OSM_ATTRIBUTION = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
        'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a></a>';

        var title = param_options.title;
        var text = param_options.text;
        var width = param_options.width || "500px";
        var height = param_options.height || "500px";
        var lat = param_options.lat || 52.204;
        var lng = param_options.lng || 0.124;
        var zoom = param_options.zoom || 15;

        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field

        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        name.appendChild(label);
        row.appendChild(name);

        var value = document.createElement('td');
        value.className = 'widget_config_property_value';
        value.style.height = height;
        value.style.width = width;
        row.appendChild(value);

        parent_el.appendChild(row);

        var osm = new L.TileLayer(OSM_TILES,
            { attribution: OSM_ATTRIBUTION,
              maxZoom: OSM_MAX_ZOOM
            }
        );

        var map = new L.Map(value).addLayer(osm);

        if (param_current && param_current.map ) {
            map.setView([param_current.map.lat, param_current.map.lng],
                         param_current.map.zoom);
        }
        else {
            map.setView([lat, lng], zoom);
        }


        return {
            value: function() {
                return {
                    map: {
                        lng: map.getCenter().lng,
                        lat: map.getCenter().lat,
                        zoom: map.getZoom(),
                    }
                };
            },
            valid: function () { return true; }
        };

    }

    // populate a table row with a Google map input widget
    function config_google_map(parent_el, param_options, param_current)
    {

        'use strict';

        console.log('Called config_google_map');

        var title = param_options.title;
        var text = param_options.text;
        var width = param_options.width || "500px";
        var height = param_options.height || "500px";
        var show_traffic = param_options.show_traffic || false;
        var lat = param_options.lat || 52.204;
        var lng = param_options.lng || 0.124;
        var zoom = param_options.zoom || 15;

        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field

        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        name.appendChild(label);
        row.appendChild(name);

        var value = document.createElement('td');
        value.className = 'widget_config_property_value';
        value.style.height = height;
        value.style.width = width;
        row.appendChild(value);

        parent_el.appendChild(row);

        var map = new google.maps.Map(value, {
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: google.maps.ControlPosition.TOP_LEFT },
            clickableIcons: false,
        });
        if (show_traffic) {
            var trafficLayer = new google.maps.TrafficLayer({
                autoRefresh: true
            });
            trafficLayer.setMap(map);
        }

        if (param_current && param_current.map ) {
            map.setCenter({lat: param_current.map.lat, lng: param_current.map.lng});
            map.setZoom(param_current.map.zoom);
        }
        else {
            map.setCenter({lat: lat, lng: lng});
            map.setZoom(zoom);
        }


        return {
            value: function() {
                return {
                    map: {
                        lng: map.getCenter().lng(),
                        lat: map.getCenter().lat(),
                        zoom: map.getZoom(),
                    }
                };
            },
            valid: function () { return true; }
        };

    }

    // populate a table row with a Leaflet map area input widget
    function config_area(parent_el, param_options, param_current)
    {

        'use strict';

        console.log('Called config_area');

        var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        var OSM_MAX_ZOOM = 19;
        var OSM_ATTRIBUTION = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
        'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a></a>';

        var title = param_options.title;
        var text = param_options.text;
        var width = param_options.width || "500px";
        var height = param_options.height || "500px";
        var lat = param_options.lat || 52.204;
        var lng = param_options.lng || 0.124;
        var zoom = param_options.zoom || 15;

        // Setup HTML
        var row = document.createElement('tr');
        // create td to hold 'name' prompt for field
        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        name.appendChild(label);
        row.appendChild(name);

        var value = document.createElement('td');
        value.className = 'widget_config_property_value';
        value.style.height = height;
        value.style.width = width;
        row.appendChild(value);

        parent_el.appendChild(row);

        // Create a map
        var osm = new L.TileLayer(OSM_TILES,
            { attribution: OSM_ATTRIBUTION,
              maxZoom: OSM_MAX_ZOOM
            }
        );

        var map = new L.Map(value).addLayer(osm);
        var drawing_layer = new L.FeatureGroup();
        map.addLayer(drawing_layer);

        // Add current data (if available) and scale/zoom
        if (param_current && param_current.areas && param_current.areas.length > 0){
            param_current.areas.forEach(function (coords) {
                L.polygon(coords).addTo(drawing_layer);
            });
        }

        // Set initial view from param_current.map, else param_current.stops,
        // else param_options
        if (param_current && param_current.map) {
            map.setView([param_current.map.lat, param_current.map.lng],
                         param_current.map.zoom);
        }
        else if (drawing_layer.getLayers().length > 0) {
            var bounds = drawing_layer.getBounds().pad(0.2);
            map.fitBounds(bounds);
        }
        else {
            map.setView([lat, lng], zoom);
        }

        // Setup Leaflet-Draaw
        // https://jsfiddle.net/user2314737/324h2d9q/
        var drawPluginOptions = {
            position: 'topright',
            draw: {
                polygon: {
                },
                // disable toolbar item by setting it to false
                polyline: false,
                circle: false, // Turns off this drawing tool
                rectangle: false,
                marker: false,
                circlemarker: false,
                },
            edit: {
                featureGroup: drawing_layer, //REQUIRED!!
            }
        };

        // Initialise the draw control
        var drawControl = new L.Control.Draw(drawPluginOptions);
        map.addControl(drawControl);

        map.on('draw:created', function(e) {
            var layer = e.layer;
            drawing_layer.addLayer(layer);
        });

        return {
            value: function() {
                var current_map = {
                    lng: map.getCenter().lng,
                    lat: map.getCenter().lat,
                    zoom: map.getZoom(),
                };
                var areas = [];
                drawing_layer.eachLayer(function (polygon) {
                    areas.push(polygon.getLatLngs()[0]);
                });
                return { map: current_map, areas: areas };
            },
            valid: function () { return true; }
        };

    }


    // *****************************************************************************
    // ********** Below is the config 'shim' code needed to include config in  *****
    // ********** active layout                                                *****

    // This adds the 'edit' link and the 'config' div to the widget
    function shim_link(self, widget_id)
    {
        var widget = document.getElementById(widget_id);

        // get absolute coords of widget (so we can position 'edit' link)
        var rect = widget.getBoundingClientRect();
        var top = Math.round(rect.top);
        var left = Math.round(rect.left);
        var width = Math.round(widget.offsetWidth);

        // create 'edit' link
        var config_link = document.createElement('a');
        var config_text = document.createTextNode('edit');
        config_link.appendChild(config_text);
        config_link.title = "Configure this widget";
        config_link.href = "#";
        config_link.onclick = function () { shim_edit(self, widget_id) };
        config_link.style = 'position: absolute; z-index: 1001';
        config_link.style.left = Math.round(rect.left+width - 50)+'px';
        config_link.style.top = Math.round(rect.top)+'px';
        document.body.appendChild(config_link);

    }

    // user has clicked the (debug) 'Configure' button
    // This is a 'shim' for the call from the Widget Framework
    function shim_edit(self, widget_id) {
        var widget = document.getElementById(widget_id);
        widget.style['background-color'] = CONFIG_COLOR;

        // create config div for properties form
        var config_window = document.createElement('div');
        config_window.setAttribute('class','widget_config');

        var config_div = document.createElement('div');
        var config_id = widget_id + '_config';
        config_div.setAttribute('id', config_id);
        config_window.appendChild(config_div);

        document.body.appendChild(config_window);

        self.log(widget_id,'calling configure with',self.params);

        var configure_result = self.configure( { config_id: config_id,
                                               },
                                               self.params);

        var save_button = document.createElement('button');
        save_button.onclick = function () { shim_save(self, widget_id, config_window, configure_result); };
        save_button.innerHTML = 'Save';
        config_window.appendChild(save_button);

        var cancel_button = document.createElement('button');
        cancel_button.onclick = function () { shim_cancel(self, widget_id, config_window); };
        cancel_button.innerHTML = 'Cancel';
        config_window.appendChild(cancel_button);

    }

    // A shim function to provide the 'config cancel' in the active layout
    function shim_cancel(self, widget_id, config_window) {
        // reset original widget background-color to WHITE
        var widget = document.getElementById(widget_id);
        if (widget) widget.style['background-color'] = 'white';

        // remove the the config window
        config_window.parentNode.removeChild(config_window);

        self.log(widget_id, 'cancel button');
    }

    // A shim function to provide the 'config save' in the active layout
    function shim_save(self, widget_id, config_window, configure_result) {
        // Here we update the existing widget 'in-place', not expected in production

        self.params = configure_result.value(); //self.params = config_params;

        self.log('config reset params to',self.params);//self.params);

        var widget = document.getElementById(widget_id);

        // reset original widget background-color to WHITE
        widget.style['background-color'] = 'white';

        // remove the the config window
        config_window.parentNode.removeChild(config_window);

        self.init();
    }

