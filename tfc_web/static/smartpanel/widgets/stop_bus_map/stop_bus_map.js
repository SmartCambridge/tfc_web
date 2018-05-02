/* Bus Stop Map Widget for ACP Lobby Screen */

// lobby_screen widget. Draws real-time buses on a map.

// used in lobby screen with:
//      new StopBusMap(<layout config object>, <widget params object>)
//
//      params are
//
//                       title: 'Live Buses: U and Citi4',
//                       stop_id: 'XXYYZZ',
//                       breadcrumbs: true,
//                       lat: 52.215,
//                       lng: 0.09,
//                       zoom: 15,
//                       stops: [  { lat:, lng:, common_name: } ... ]
//
function StopBusMap(widget_id, params) {

    'use strict';

    //var DEBUG = ' stop_bus_map_log';

    var CONFIG_SHIM = true;

    var self = this;

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

    var sensors = {};

    var map;

    var map_tiles;

    var progress_indicators = {}; // dictionary by VehicleRef

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var oldsensorIcon;


    var OLD_DATA_RECORD = 70; // time (s) threshold where a data record is considered 'old'

    var OBSOLETE_DATA_RECORD = 140; // at this age, we discard the sensor

    var PROGRESS_MIN_DISTANCE = 20;

    var CRUMB_COUNT = 400; // how many breadcrumbs to keep on the page

    var BUS_SPEED = 7; // m/s speed of buses for 'pac-man' bus position indicator

    // Here we define the 'data record format' of the incoming websocket feed
    var RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    var RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
    var RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    var RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                       // 'ISO8601' = iso-format string
    var RECORD_LAT = 'Latitude';      // name of property containing latitude
    var RECORD_LNG = 'Longitude';     // name of property containing longitude

    // *****************
    //

    var icon_size = 'L';

    var crumbs = []; // array to hold breadcrumbs as they are drawn

    var progress_timer;

    var connected = false; // global to record state of connection to rt_monitor real-time data

    // backwards compatibility init() function
    this.init = function () {
        self.log(self.widget_id, 'Running BusStopMap.init');

        self.display(self.config, self.params);
    };

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        oldsensorIcon = L.icon({
            iconUrl: self.config.static_url+'images/bus-logo.png',
            iconSize: [20, 20]
        });

        sensors = {}; // this is the array of buses seen so far

        progress_indicators = {}; // these are the 'pac-man' indicators showing bus progress

        var container_el = document.getElementById(self.config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF)
        while (container_el.firstChild) {
                container_el.removeChild(container_el.firstChild);
        }

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','stop_bus_map_connection_div');
        connection_div.setAttribute('id', self.config.container_id+'_connection');
        connection_div.appendChild(document.createTextNode("Connection issues"));
        container_el.appendChild(connection_div);

        var title_h1 = document.createElement('h1');
        title_h1.setAttribute('class', 'stop_bus_map_title_h1');
        title_h1.setAttribute('id', self.config.container_id+'_title_h1');
        var img = document.createElement('img');
        img.setAttribute('src', self.config.static_url + 'images/bus.png');
        title_h1.appendChild(img);
        title_h1.appendChild(document.createTextNode(' '));
        title_h1.appendChild(document.createTextNode(self.params.title));

        container_el.appendChild(title_h1);

        var map_div = document.createElement('div');
        map_div.setAttribute('class','stop_bus_map_div');
        map_div.setAttribute('id', self.config.container_id+'_map');
        container_el.appendChild(map_div);

        map = L.map(map_div, { zoomControl:false }).setView([self.params.map.lat, self.params.map.lng], self.params.map.zoom);
        map_tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

        RTMONITOR_API.ondisconnect(rtmonitor_disconnected);

        RTMONITOR_API.onconnect(rtmonitor_connected);

        // if we're already connected to rt_monitor perhaps this is a re-init of existing widget
        if (connected) {
            self.log(self.widget_id, 'init() already connected to rt_monitor');
            subscribe();
        } else {
            self.log(self.widget_id, 'init() not connected to rt_monitor');
        }

        draw_stops(self.params.stops);

        // create a timer to update the progress indicators every second
        progress_timer = setInterval( timer_update, SECONDS);

    };

    /*this.reload = function() {
        self.log("Running StationBoard.reload", config.container);
        this.do_load();
    }*/

function rtmonitor_disconnected()
{
    self.log(self.widget_id, 'stop_bus_map rtmonitor_disconnected (connected was',connected,')');
    connected = false;
    document.getElementById(self.config.container_id+'_connection').style.display = 'inline-block';
}

function rtmonitor_connected()
{
    self.log(self.widget_id, 'stop_busi_map rtmonitor_connected (connected was',connected,')');
    connected = true;
    document.getElementById(self.config.container_id+'_connection').style.display = 'none';
    subscribe();
}

function subscribe()
{
    self.log(self.widget_id, 'subscribe() sending request');

    var map_bounds = map.getBounds();

    var map_sw = map_bounds.getSouthWest();
    var map_ne = map_bounds.getNorthEast();

    // We will subscribe to real-time data in a box larger than the map bounds
    var boundary_ns = (map_ne.lat - map_sw.lat) * 0.5;
    var boundary_ew = (map_ne.lng - map_sw.lng) * 0.5;
    var north = map_ne.lat + boundary_ns;
    var south = map_sw.lat - boundary_ns;
    var east = map_ne.lng + boundary_ew;
    var west = map_sw.lng - boundary_ew;
    L.rectangle([[south,west],[north,east]], { fillOpacity: 0 }).addTo(map);

    var request_id = 'A';

    // Subscribe to the real-time data INSIDE a clockwise rectangle derived from map bounds
    // Note RTMonitorAPI will at the "msg_type": "rt_subscribe" and the "request_id"
    var request = {
             filters: [ { test: 'inside',
                          lat_key: 'Latitude',
                          lng_key: 'Longitude',
                          points: [ {  lat: north, lng: west },
                                    {  lat: north, lng: east },
                                    {  lat: south, lng: east },
                                    {  lat: south, lng: west }
                                  ]
                        } ] };

    var request_status = RTMONITOR_API.subscribe(self.widget_id,
                                                 request_id,
                                                 request,
                                                 handle_records);

    self.log(self.widget_id, 'request_status '+request_status.status);
}

// We have received data from a previously unseen sensor, so initialize
function create_sensor(msg, clock_time)
{
    // new sensor, create marker
    self.log(self.widget_id, 'stop_bus_map ** New '+msg[RECORD_INDEX]);

    var sensor_id = msg[RECORD_INDEX];

    var sensor = { sensor_id: sensor_id,
                   msg: msg,
                 };

    var marker_icon = create_sensor_icon(msg);

    sensor['marker'] = L.Marker.movingMarker([[msg[RECORD_LAT], msg[RECORD_LNG]],
                                              [msg[RECORD_LAT], msg[RECORD_LNG]]],
                                             [1 * SECONDS],
                                             {icon: marker_icon});
    sensor['marker']
        .addTo(map)
        .bindPopup(popup_content(msg), { className: "sensor-popup"})
        .bindTooltip(tooltip_content(msg), {
                            // permanent: true,
                            className: "sensor-tooltip",
                            interactive: true
                          })
        .on('click', function()
                {
                  //self.log("marker click handler");
                })
        .start();

    sensor.state = {};

    sensors[sensor_id] = sensor;

    // flag if this record is OLD or NEW
    init_old_status(sensor, new Date());

}

// We have received a new data message from an existing sensor, so analyze and update state
function update_sensor(msg, clock_time)
{
		// existing sensor data record has arrived

        var sensor_id = msg[RECORD_INDEX];

		if (get_msg_date(msg).getTime() != get_msg_date(sensors[sensor_id].msg).getTime())
        {
            // store as latest msg
            // moving current msg to prev_msg
            sensors[sensor_id].prev_msg = sensors[sensor_id].msg;
		    sensors[sensor_id].msg = msg; // update entry for this msg

            var sensor = sensors[sensor_id];

            // move marker
            var pos = get_msg_point(msg);

            if (self.params.breadcrumbs && map.getBounds().contains(L.latLng(pos)))
            {
                add_breadcrumb(sensor);
            }

            var marker = sensors[sensor_id].marker;
		    marker.moveTo([pos.lat, pos.lng], [1 * SECONDS] );
		    marker.resume();

            // update tooltip and popup
		    marker.setTooltipContent(tooltip_content(msg));
		    marker.setPopupContent(popup_content(msg));

            draw_progress_indicator(sensor);

            // flag if this record is OLD or NEW
            update_old_status(sensor, new Date());

		}
}

function timer_update()
{
    check_old_records(new Date());

    // cull obsolete sensors
    //
    for (var sensor_id in sensors)
    {
        if (sensors.hasOwnProperty(sensor_id) && sensors[sensor_id].state.obsolete)
        {
            self.log(self.widget_id, 'culling '+sensor_id);
            delete sensors[sensor_id];

            if (progress_indicators[sensor_id])
            {
                //self.log('draw_progress_indicator removing layer '+sensor_id);
                map.removeLayer(progress_indicators[sensor_id].layer);
                delete progress_indicators[sensor_id];
            }
        }
    }

    for (var sensor_id in progress_indicators)
    {
        if (progress_indicators.hasOwnProperty(sensor_id))
        {
            //parent.log('(timer) timer_update '+sensor_id);
            draw_progress_indicator(sensors[sensor_id]);
        }
    }
}

function draw_progress_indicator(sensor)
{
    var sensor_id = sensor.msg[RECORD_INDEX];

    //self.log('draw_progress_indicator '+sensor_id);

    // Remove old progress indicator
    if (progress_indicators[sensor_id])
    {
        //self.log('draw_progress_indicator removing layer '+sensor_id);
        map.removeLayer(progress_indicators[sensor_id].layer);
    }

    if (sensor.state.old == null || !sensor.state.old)
    {
        var progress_indicator = {};

        var pos = get_msg_point(sensor.msg);

        var prev_pos = get_msg_point(sensor.prev_msg);

        var distance = get_distance(prev_pos, pos);

        // only update bearing of bus if we've moved at least 40m
        if (distance > PROGRESS_MIN_DISTANCE)
        {
            sensor.progress_bearing = get_bearing(prev_pos, pos);
        }

        if (!sensor.progress_bearing)
        {
            sensor.progress_bearing = 0;
        }

        //self.log(sensor_id+' at '+(new Date())+' vs '+msg.received_timestamp);

        var time_delta = ((new Date()).getTime() - sensor.msg.received_timestamp.getTime()) / 1000;

        var progress_distance = Math.max(20, time_delta * BUS_SPEED);

        //self.log('progress_distance '+sensor_id+' '+Math.round(time_delta*10)/10+'s '+Math.round(progress_distance)+'m';

        progress_indicator.layer = L.semiCircle([pos.lat, pos.lng],
                                                { radius:  progress_distance,
                                                  color: '#05aa05',
                                                  fillOpacity: 0.15,
                                                  dashArray: [5, 8],
                                                  weight: 3
                                                }).setDirection(sensor.progress_bearing,270);

        progress_indicators[sensor_id] = progress_indicator;

        progress_indicator.layer.addTo(map);
    }
}

// draw a breadcrumb, up to max of CRUMB_COUNT.  After CRUMB_COUNT, we replace a random previous breadcrumb
function add_breadcrumb(sensor)
{
    var pos = get_msg_point(sensor.msg);

    var prev_pos = get_msg_point(sensor.prev_msg);

    var distance = get_distance(prev_pos, pos);

    // only update bearing of bus if we've moved at least 40m
    if (distance > PROGRESS_MIN_DISTANCE)
    {
        var crumb = L.circleMarker([pos.lat, pos.lng], { color: 'blue', radius: 1 }).addTo(map);
        if (crumbs.length < CRUMB_COUNT) // fewer than CRUMB_COUNT so append
        {
            crumbs.push(crumb);
        }
        else // replace a random existing crumb
        {
            var index = Math.floor(Math.random() * CRUMB_COUNT);
            map.removeLayer(crumbs[index]);
            crumbs[index] = crumb;
        }
    }
}

// Given a data record, update '.old' property t|f and reset marker icon
// Note that 'current time' is the JS date value in global 'clock_time'
// so that this function works equally well during replay of old data.
//
function init_old_status(sensor, clock_time)
{
    update_old_status(sensor, clock_time);
}

function update_old_status(sensor, clock_time)
{
    var data_timestamp = sensor.msg.received_timestamp;

    //var data_timestamp = get_msg_date(sensor.msg); // will hold Date from sensor

    // get current value of sensor.state.old flag (default false)
    var current_old_flag = !(sensor.state.old == null) || sensor.state.old;

    // calculate age of sensor (in seconds)
    var age = (clock_time - data_timestamp) / 1000;

    if (age > OLD_DATA_RECORD)
    {
        if (age > OBSOLETE_DATA_RECORD)
        {
            map.removeLayer(sensor.marker);
            sensor.state.obsolete = true;
            return;
        }
        // data record is OLD
        // skip if this data record is already flagged as old
        if (sensor.state.old != null && sensor.state.old)
        {
            return;
        }
        // set the 'old' flag on this record and update icon
        self.log(self.widget_id, 'update_old_status OLD '+sensor.msg[RECORD_INDEX]);
        sensor.state.old = true;
        sensor.marker.setIcon(oldsensorIcon);
    }
    else
    {
        // data record is NOT OLD
        // skip if this data record is already NOT OLD
        if (sensor.state.old != null && !sensor.state.old)
        {
            return;
        }
        // reset the 'old' flag on this data record and update icon
        sensor.state.old = false;
        sensor.marker.setIcon(create_sensor_icon(sensor.msg));
    }
}

// return {lat:, lng:} from sensor message
function get_msg_point(msg)
{
    return { lat: msg[RECORD_LAT], lng: msg[RECORD_LNG] };
}

// return a JS Date() from sensor message
function get_msg_date(msg)
{
    switch (RECORD_TS_FORMAT)
    {
        case 'ISO8601':
            return new Date(msg[RECORD_TS]);
            break;

        default:
            break;
    }
    return null;
}

// ***********************************************************
// Pretty print an XML duration
// Convert '-PT1H2M33S' to '-1:02:33'
function xml_duration_to_string(xml)
{
    var seconds = xml_duration_to_seconds(xml);

    var sign = (seconds < 0) ? '-' : '+';

    seconds = Math.abs(seconds);

    if (seconds < 60)
    {
        return sign + seconds + 's';
    }

    var minutes = Math.floor(seconds / 60);

    var remainder_seconds = ('0' + (seconds - minutes * 60)).slice(-2);

    if (minutes < 60)
    {
        return sign + minutes + ':' + remainder_seconds;
    }

    var hours = Math.floor(minutes / 60);

    var remainder_minutes = ('0' + (minutes - hours * 60)).slice(-2);

    return sign + hours + ':' + remainder_minutes + ':' + remainder_seconds;
}

// Parse an XML duration like '-PT1H2M33S' (minus 1:02:33) into seconds
function xml_duration_to_seconds(xml)
{
    if (!xml || xml == '')
    {
        return 0;
    }
    var sign = 1;
    if (xml.slice(0,1) == '-')
    {
        sign = -1;
    }
    var hours = get_xml_digits(xml,'H');
    var minutes = get_xml_digits(xml,'M');
    var seconds = get_xml_digits(xml,'S');

    return sign * (hours * 3600 + minutes * 60 + seconds);
}

// Given '-PT1H2M33S' and 'S', return 33
function get_xml_digits(xml, units)
{
    var end = xml.indexOf(units);
    if (end < 0)
    {
        return 0;
    }
    var start = end - 1;
    // slide 'start' backwards until it points to non-digit
    while (/[0-9]/.test(xml.slice(start, start+1)))
    {
        start--;
    }

    return Number(xml.slice(start+1,end));
}

// End of the XML duration pretty print code
// *************************************************************

// return a Leaflet Icon based on a real-time msg
function create_sensor_icon(msg)
{
    var line = '';

    if (msg.LineRef != null)
    {
        line = msg.LineRef;
    }

    var marker_html =  '<div class="marker_label_'+icon_size+'">'+line+'</div>';

    var marker_size = new L.Point(30,30);

    switch (icon_size)
    {
        case 'L':
            marker_size = new L.Point(45,45);
            break;

        default:
            break;
    }

    return L.divIcon({
        className: 'marker_sensor_'+icon_size,
        iconSize: marker_size,
        iconAnchor: L.point(23,38),
        html: marker_html
    });
}

// return a Leaflet Icon based on a 'stop'
// { stop_id:
//   common_name:
//   lat:
//   lng:
// }
function create_stop_icon(stop)
{
    var common_name = '';

    if (stop.common_name != null)
    {
        common_name = stop.common_name;
    }

    var marker_html =  '<div class="marker_stop_label_'+icon_size+'">'+common_name+'</div>';

    var marker_size = new L.Point(30,30);

    switch (icon_size)
    {
        case 'L':
            marker_size = new L.Point(100,40);
            break;

        default:
            break;
    }

    return L.divIcon({
        className: 'marker_stop_'+icon_size,
        iconSize: marker_size,
        iconAnchor: L.point(3,40),
        html: marker_html
    });
}


function tooltip_content(msg)
{
    var time = get_msg_date(msg);
    var time_str = ("0" + time.getHours()).slice(-2)   + ":" +
                   ("0" + time.getMinutes()).slice(-2) + ":" +
                   ("0" + time.getSeconds()).slice(-2);
    return time_str +
            '<br/>' + msg[RECORD_INDEX] +
			'<br/>Line "' + msg['PublishedLineName'] +'"'+
            '<br/>Delay: ' + xml_duration_to_string(msg['Delay']);
}

function popup_content(msg)
{
    var time = get_msg_date(msg);
    var time_str = ("0" + time.getHours()).slice(-2)   + ":" +
                   ("0" + time.getMinutes()).slice(-2) + ":" +
                   ("0" + time.getSeconds()).slice(-2);
    var sensor_id = msg[RECORD_INDEX];
    return time_str +
        '<br/>' + sensor_id +
		'<br/>Line "' + msg['PublishedLineName'] +'"'+
        '<br/>Delay: ' + xml_duration_to_string(msg['Delay']);
}

// user has clicked on 'more' in the sensor popup
function more_content(sensor_id)
{
    var sensor = sensors[sensor_id];
    var content = JSON.stringify(sensor.msg).replace(/,/g,', ');
    content +=
        '<br/><a href="#" onclick="click_less('+"'"+sensor_id+"'"+')">less</a>';
    return content;
}

// ********************************************************************************
// ***********  Process the data records arrived from WebSocket or Replay *********
// ********************************************************************************

// Process websocket data
function handle_records(incoming_data)
{
    //var incoming_data = JSON.parse(websock_data);
    self.log(self.widget_id, 'handle_records'+incoming_data['request_data'].length);
    for (var i = 0; i < incoming_data[RECORDS_ARRAY].length; i++)
    {
	    handle_msg(incoming_data[RECORDS_ARRAY][i], new Date());
    }
} // end function handle_records

this.log = function() {
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_bus_map_log') >= 0) {
        console.log.apply(console, arguments);
    }
};

// process a single data record
function handle_msg(msg, clock_time)
{
    // Add a timestamp for when we received this data record
    msg.received_timestamp = new Date();

    var sensor_id = msg[RECORD_INDEX];

    // If an existing entry in 'sensors' has this key, then update
    // otherwise create new entry.
    if (sensors.hasOwnProperty(sensor_id))
    {
        update_sensor(msg, clock_time);
    }
    else
    {
        create_sensor(msg, clock_time);
    }
}

// watchdog function to flag 'old' data records
// records are stored in 'this.sensors' object
function check_old_records(clock_time)
{
    //parent.log('checking for old data records..,');

    // do nothing if timestamp format not recognised
    switch (RECORD_TS_FORMAT)
    {
        case 'ISO8601':
            break;

        default:
            return;
    }

    for (var sensor_id in sensors)
    {
        update_old_status(sensors[sensor_id], clock_time);
    }
}

// Draw the stops given in the widget params on the map
function draw_stops(stops)
{
    self.log('drawing '+stops.length+' stops');
    for (var i=0; i < stops.length; i++)
    {
        draw_stop(stops[i]);
    }
}

// Draw a stop on the map
//
function draw_stop(stop)
{
    var marker_icon = create_stop_icon(stop);
    L.marker([stop.lat, stop.lng],
             {icon: marker_icon})
     .addTo(map);
}


    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var CONFIG_TITLE = 'Configure Real-Time Bus Map';

        self.log(self.widget_id, 'StopBusMap configuring widget with', config.container_id, params);

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

        var input_result = input_widget(config_form, params);

        config_div.appendChild(config_form);

        return input_result;
    } // end this.configure()

    // Input the StopTimetable parameters
    function input_widget(parent_el, params) {

        var config_table = document.createElement('table');
        var config_tbody = document.createElement('tbody');

        // Title input
        //
        self.log(self.widget_id, 'configure() calling config_input', 'title', 'with',params.title);
        var title_result = config_input( parent_el,
                                          'string',
                                          { text: 'Title:',
                                            title: 'Choose a title to overlay the map'
                                          },
                                          params.title);

        self.log(self.widget_id, 'configure() calling input_map', 'map', 'with',params.map);
        var map_result = input_map( parent_el, params.map);

        // Breadcrumbs  select BOOLEAN
        //
        self.log(self.widget_id, 'configure() calling config_input', 'breadcrumbs', 'with',params.breadcrumbs);
        var breadcrumbs_result = config_input(  parent_el,
                                            'select',
                                            { text: 'Breadcrumbs:',
                                              title: 'Draw dots showing the real-time paths of the buses',
                                              format: 'boolean',
                                              options: [ { value: 'true', text: 'Yes' },
                                                         { value: 'false', text: 'No' }
                                                       ]
                                            },
                                            params.breadcrumbs
                                         );

        var stops_result = input_stops( parent_el, params.stops);

        config_table.appendChild(config_tbody);

        // append this input table to the DOM object originally given in parent_el
        parent_el.appendChild(config_table);

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // title
            config_params.title = title_result.value(); // string

            // map
            config_params.map = map_result.value(); // { lat:, lng:, zoom: }

            // breadcrumbs
            config_params.breadcrumbs = breadcrumbs_result.value(); // boolean

            // stops
            config_params.stops = stops_result.value(); // [ { lat:, lng:, common_name: } .. ]

            self.log(self.widget_id,'input_widget returning params:',config_params);

            return config_params;
        };

        var config_fn = function () {
            return { title: title_result.value() };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    } // end input_widget()i

    // input a map lat / lng / zoom
    function input_map(parent_el, map_params) {
        // lat
        //
        var lat_result = config_input( parent_el,
                                          'number',
                                          { text: 'Latitude:',
                                            title: 'Enter latitude of centre of map, e.g. 52.215'
                                          },
                                          map_params.lat);

        var lng_result = config_input( parent_el,
                                          'number',
                                          { text: 'Longitude:',
                                            title: 'Enter longitude of centre of map (West is negative), e.g. 0.09'
                                          },
                                          map_params.lng);

        var zoom_result = config_input( parent_el,
                                          'number',
                                          { text: 'Zoom:',
                                            title: 'Zoom for the map, e.g. 15 (bigger zooms IN)'
                                          },
                                          map_params.zoom);

        // value() is the function for this input element that returns its value
        var value = function () {
            var config_params = {};

            // lat
            config_params.lat = parseFloat(lat_result.value());

            // lng
            config_params.lng = parseFloat(lng_result.value());

            // zoom
            var zoom = parseInt(zoom_result.value());
            if (!isNaN(zoom) && zoom >= 0 && zoom <= 18) {
                config_params.zoom = zoom;
            } else {
                self.log(self.widget_id,'input_map bad zoom value');
                config_params.zoom = 15;
            }

            self.log(self.widget_id,'input_map returning params:',config_params);

            return config_params;
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 value: value };

    } // end input_map

    //DEBUG this is a stub
    function input_stops(parent_el, stops_param) {

        var value = function () {
            var config_params = [ { lat: 52.21129, lng: 0.09107, common_name: 'Gates Bldg' } ];

            self.log(self.widget_id,'input_stops returning params:',config_params);

            return config_params;

        }

        return { value: value,
                 valid: function () { return true; }
               };
    } // end input_stops


// END of 'class' StopBusMap
}

