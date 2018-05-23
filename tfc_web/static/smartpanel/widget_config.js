

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
    // this.input(
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
function WidgetConfig(config) {

    var CONFIG_COLOR = '#ffffe6';

    this.config = config;

    this.input = function (parent_el, param_type, param_options, param_current) {
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

            case 'bus_stop':
                input_info = config_bus_stop(parent_el, param_options, param_current);
                break;

            case 'bus_destination':
                input_info = config_bus_destination(parent_el, param_options, param_current);
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
    } // end this.input

    this.choose = function(parent_el, param_type, param_options, param_current)
    {
        //self.log('creating input', param_name, param_type, param_options, param_current);
        var chooser_return = null; // info to return, .value() = data callback
        switch (param_type) {
            case 'bus_stops':
                chooser_return = choose_bus_stops(parent_el, param_options, param_current);
                break;

            default:
                chooser_return = null;
        }

        return chooser_return;
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
        td_select.setAttribute('class', 'widget_config_property_value');
        var sel = document.createElement('select');
        sel.setAttribute('class', 'mdl-textfield__input');

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
    } // end config_select

    function config_number(parent_el, param_options, param_current) {
        if (!param_options.type) param_options.type = 'number';
        return config_string(parent_el, param_options, param_current);
    } // end config_number

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

        // this fn will be called when user clicks 'save' on chooser
        var chooser_save = function(chooser_return)
        {
            //debug
            console.log('widget_config.js chooser_save', chooser_return.value());
            var chooser_return_value = chooser_return.value();
            if (chooser_return_value)
            {
                input.value = chooser_return_value;
            }
        };

        // if a 'chooser' function has been provided, add as onclick call
        if (param_options.chooser)
        {
            var chooser_link = document.createElement('a');
            chooser_link.setAttribute('href', '#');
            chooser_link.innerHTML = 'choose';
            chooser_link.onclick = function () { config_chooser(parent_el,
                                                                chooser_link,
                                                                param_options.chooser,
                                                                chooser_save); };
            td_value.appendChild(chooser_link);
        }

        row.appendChild(td_value);

        parent_el.appendChild(row);

        return { value: function() { return input.value; },
                 valid: function () { return true; }
            };
    } // end config_string

    // Input a single bus stop { stop_id: '0500CCITY424', common_name: ... }
    function config_bus_stop(parent_el, param_options, param_current)
    {
        //debug
        console.log('WidgetConfig','config_bus_stop', param_options, param_current);

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

        var input = document.createElement('input');

        input.type = 'text';

        if (param_options.title) input.title = param_options.title;

        // set default value of input to value provided in param_current
        //self.log(param_name,'default set to',param_current);
        if (param_current) input.value = param_current.common_name;

        td_value.appendChild(input);

        var chooser_value = null;

        // this fn will be called when user clicks 'save' on chooser
        var chooser_save = function(chooser_return)
        {
            //debug
            console.log('widget_config.js chooser_save', chooser_return.value());
            chooser_value = chooser_return.value();
            if (chooser_value)
            {
                input.value = chooser_value.stops[0].common_name;
            }
        };

        var chooser_fn = function (input_div) {
            return choose_bus_stops( input_div, { multi_select: false }, { stops: [ param_current ] } );
        };

        var chooser_link = document.createElement('a');
        chooser_link.setAttribute('href', '#');
        chooser_link.innerHTML = 'choose stop';
        chooser_link.onclick = function () { config_chooser(parent_el,
                                                            chooser_link,
                                                            //param_options,
                                                            //param_current,
                                                            chooser_fn,
                                                            chooser_save); };
        td_value.appendChild(chooser_link);

        row.appendChild(td_value);

        parent_el.appendChild(row);

        return { value: function() { return chooser_value && chooser_value.stops ? chooser_value.stops[0] : param_current ; },
                 valid: function () { return true; }
            };
    } // end config_bus_stop

    // Input a bus destination
    // { description: 'City Centre',
    //   stops: [ { stop_id: '0500CCITY424', common_name: ... }, ... ]
    //   areas: [ list of areas ] where each 'area' is a list of lat/lng points
    // }
    function config_bus_destination(parent_el, param_options, param_current)
    {
        //debug
        console.log('WidgetConfig','config_bus_destination', param_options, param_current);

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

        var input = document.createElement('input');

        input.type = 'text';

        if (param_options.title) input.title = param_options.title;

        // set default value of input to value provided in param_current
        //self.log(param_name,'default set to',param_current);
        if (param_current) input.value = param_current.description;

        td_value.appendChild(input);

        // Here's a 'local' variable to store whatever the selected chooser returns,
        // so that a subsequent 'save' of the entire widget config will get that value.
        // The var is WRITTEN in the chooser_save function, and READ in the { value: fn returned by this
        // config input element.
        var chooser_value = null;

        // This fn will be called when user clicks 'save' on chooser
        // It simply saves the value() of the chooser in local var chooser_value
        var chooser_save_fn = function(chooser_return)
        {
            //debug
            console.log('widget_config.js chooser_save', chooser_return.value());
            chooser_value = chooser_return.value();
        };

        var chooser_stops_fn = function (input_div) {
            return choose_bus_stops( input_div, { multi_select: true }, param_current ? param_current : null );
        };

        var chooser_area_fn = function (input_div) {
            return choose_area( input_div, { }, param_current ? param_current : null );
        };

        var chooser_links_div = document.createElement('div');
        td_value.appendChild(chooser_links_div);

        var chooser_stops_link = document.createElement('a');

        chooser_stops_link.setAttribute('class','widget_config_chooser_link');
        chooser_stops_link.setAttribute('href', '#');
        chooser_stops_link.innerHTML = 'choose stops';
        chooser_stops_link.onclick = function () { config_chooser(parent_el,
                                                            chooser_links_div,
                                                            chooser_stops_fn,
                                                            chooser_save_fn); };
        chooser_links_div.appendChild(chooser_stops_link);

        var chooser_area_link = document.createElement('a');

        chooser_area_link.setAttribute('class','widget_config_chooser_link');
        chooser_area_link.setAttribute('href', '#');
        chooser_area_link.innerHTML = 'choose area';
        chooser_area_link.onclick = function () { config_chooser(parent_el,
                                                            chooser_links_div,
                                                            chooser_area_fn,
                                                            chooser_save_fn); };
        chooser_links_div.appendChild(chooser_area_link);

        row.appendChild(td_value);

        parent_el.appendChild(row);

        return { value: function() {
                            var return_value = param_current;
                            if (chooser_value && chooser_value.stops && chooser_value.stops.length > 0)
                            {
                              return_value =  { description: input.value,
                                                stops: chooser_value.stops
                                               };
                            }
                            else if (chooser_value && chooser_value.areas && chooser_value.areas.length > 0)
                            {
                              return_value =  { description: input.value,
                                                area: chooser_value.areas[0]
                                               };
                            }
                            //debug
                            console.log('widget_config','config_area','returning',return_value);
                            return return_value;
                        },
                 valid: function () { return true; }
            };
    } // end config_bus_destination


    // choose_bus_stops
    // This is simpler, and used by, config_bus_stops().
    // This function just renders the actual chooser into a div (rather than a table row with title)
    // param_current is { map: { ... }, stops: [ {stop}, ... ] }
    function choose_bus_stops(parent_el, param_options, param_current)
    {
        //debug
        console.log('WidgetConfig','choose_bus_stops',param_options, param_current);
        var chooser = BusStopChooser.create(param_options);
        chooser.render(parent_el, param_current);
        return chooser;
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

    } // end config_leaflet_map

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
        parent_el.appendChild(row);
        // create td to hold 'name' prompt for field

        var td_name = document.createElement('td');
        td_name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        td_name.appendChild(label);
        row.appendChild(td_name);

        var td_value = document.createElement('td');
        td_value.className = 'widget_config_property_value';
        //td_value.style.height = height;
        //td_value.style.width = width;
        row.appendChild(td_value);

        var map_div = document.createElement('div');
        map_div.setAttribute('style', 'height: 550px; width: 550px');
        td_value.appendChild(map_div);

        var map = new google.maps.Map(map_div, {
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

    } // end config_google_map

    // populate a table row with a Leaflet map area input widget
    function config_area(parent_el, param_options, param_current)
    {

        //debug
        console.log('widget_config','Called config_area');


        var title = param_options.title;
        var text = param_options.text;
        var width = param_options.width || "500px";
        var height = param_options.height || "500px";

        // Setup HTML
        var row = document.createElement('tr');
        parent_el.appendChild(row);

        // create td to hold 'name' prompt for field
        var name = document.createElement('td');
        name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = title;
        label.appendChild(document.createTextNode(text));
        name.appendChild(label);
        row.appendChild(name);

        var td_value = document.createElement('td');
        td_value.className = 'widget_config_property_value';
        td_value.style.height = height;
        td_value.style.width = width;
        row.appendChild(td_value);

        var chooser_return = choose_area(td_value, param_options, param_current);

        return chooser_return;

    } // end config_area

    // choose_area
    // param_current is { map: { ... }, areas: [ (area), ... ] }
    function choose_area(parent_el, param_options, param_current)
    {
        var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        var OSM_MAX_ZOOM = 19;
        var OSM_ATTRIBUTION = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
        'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a></a>';

        //debug
        console.log('WidgetConfig','choose_area',param_options, param_current);

        var lat = param_options.lat || 52.204;
        var lng = param_options.lng || 0.124;
        var zoom = param_options.zoom || 15;

        // Create a map
        var osm = new L.TileLayer(OSM_TILES,
            { attribution: OSM_ATTRIBUTION,
              maxZoom: OSM_MAX_ZOOM
            }
        );

        var map = new L.Map(parent_el).addLayer(osm);
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

    // pop up a chooser, nearby element 'el'
    //function config_chooser(parent_el, el, param_options, param_current, chooser, save_fn) {
    function config_chooser(parent_el, el, chooser, save_fn) {

        var el_bounds = el.getBoundingClientRect();

        var pos_x = Math.floor(el_bounds.left);
        var pos_y = Math.floor(el_bounds.top);

        //debug
        console.log('WidgetConfig', 'config_chooser', pos_x, pos_y);

        var width = 500; // TODO get from layout_config
        var height = 500;

        // create outermost chooser div
        var chooser_div = document.createElement('div');

        var chooser_div_style = 'width: '+width+'px; height: '+(height+50)+'px;';
        chooser_div_style += ' position: absolute;';
        chooser_div_style += ' border: 5px ridge;';
        chooser_div_style += ' background-color: white;';
        chooser_div_style += ' z-index: 2000;';

        chooser_div_style += ' left: '+pos_x+'px; top: '+pos_y+'px;';

        chooser_div.setAttribute('style', chooser_div_style);

        //parent_el.appendChild(chooser_div);
        document.body.appendChild(chooser_div);

        var input_div = document.createElement('div');
        chooser_div.appendChild(input_div);
        var input_div_style = 'width: '+width+'px; height: '+height+'px;';
        input_div.setAttribute('style', input_div_style);

        var chooser_return = chooser(input_div);

        //TODO add save, cancel onclick callbacks

        var chooser_cancel = function () {
            chooser_div.parentNode.removeChild(chooser_div);
        };

        // on save, call the 'save_fn' provided by the caller, with the result of the chooser
        var chooser_save = function () {
            // TODO may need to error check here
            save_fn(chooser_return);
            chooser_div.parentNode.removeChild(chooser_div);
        }

        // add 'cancel', 'save' buttons
        var save_button = document.createElement('a');
        save_button.setAttribute('class',
                'widget_config_chooser_button '+
                'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored');
        save_button.innerHTML = 'Save';
        save_button.onclick = chooser_save;
        chooser_div.appendChild(save_button);

        var cancel_button = document.createElement('a');
        cancel_button.setAttribute('class',
                'widget_config_chooser_button '+
                'mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored');
        cancel_button.innerHTML = 'Cancel';
        cancel_button.onclick = chooser_cancel;
        chooser_div.appendChild(cancel_button);

    }

} // end WidgetConfig()

