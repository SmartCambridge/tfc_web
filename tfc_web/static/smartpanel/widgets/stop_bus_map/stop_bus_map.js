/* Bus Stop Map Widget for ACP Lobby Screen */

// lobby_screen widget. Draws real-time buses on a map.

// used in lobby screen with:
//      new StopBusMap(<container div id>, <params object>)
//
//      e.g.
//
//      new StopBusMap('stop_bus_map_1',         // 'id' of DOM object (e.g. DIV) this widget should launch into
//                     { id: 'stop_bus_map_1',   // params: configure the widget
//                       static_url: '/lobby_screen/static',
//                       title: 'Live Buses: U and Citi4',
//                       stop_id: 'XXYYZZ',
//                       breadcrumbs: true,
//                       lat: 52.215,
//                       lng: 0.09,
//                       zoom: 15 });
//
function StopBusMap(config, params) {

    var self = this;

    var STATIC_URL;

    STATIC_URL = config.static_url;

    this.container = config.container;

    var sensors = {};

    var map;

    var map_tiles;

    var progress_indicators = {}; // dictionary by VehicleRef

    var OLD_DATA_RECORD = 70; // time (s) threshold where a data record is considered 'old'

    var OBSOLETE_DATA_RECORD = 140; // at this age, we discard the sensor

    var PROGRESS_MIN_DISTANCE = 20;

    var CRUMB_COUNT = 400; // how many breadcrumbs to keep on the page

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
    var ICON_URL = STATIC_URL+'/images/bus-logo.png';

    var icon_size = 'L';

    var oldsensorIcon = L.icon({
        iconUrl: ICON_URL,
        iconSize: [20, 20]
    });

    var crumbs = []; // array to hold breadcrumbs as they are drawn

    var progress_timer;

    this.init = function() {
        log("Instantiated StopBusMap", config.container, params);

        var container_el = document.getElementById(config.container);

        log("Running StopBusMap.init", config.container);

        // Empty the 'container' div (i.e. remove loading GIF)
        while (container_el.firstChild) {
                container_el.removeChild(container_el.firstChild);
        }

        // Write HTML into 'container' div:
        //
        // <div id="<container>_title_div">
        //   <div id="<container>_title_text>TITLE HERE (params.title)</div>
        // </div>
        //<div id="<container>_map">MAP WILL GO HERE</div>
        //

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','stop_bus_map_connection_div');
        connection_div.setAttribute('id', config.container+'_connection');
        connection_div.innerHTML = "Connection issues";
        container_el.appendChild(connection_div);

        var title_h1 = document.createElement('h1');
        title_h1.setAttribute('class', 'stop_bus_map_title_h1');
        title_h1.setAttribute('id', config.container+'_title_h1');
        var img = document.createElement('img');
        img.setAttribute('src', config.static_url + 'images/bus.png');
        title_h1.appendChild(img);
        title_h1.appendChild(document.createTextNode(' '));
        title_h1.appendChild(document.createTextNode(params.title));

        container_el.appendChild(title_h1);

        var map_div = document.createElement('div');
        map_div.setAttribute('class','stop_bus_map_div');
        map_div.setAttribute('id', config.container+'_map');
        container_el.appendChild(map_div);

        map = L.map(map_div, { zoomControl:false }).setView([params.lat, params.lng], params.zoom);
        map_tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

        RTMONITOR_API.ondisconnect(rtmonitor_disconnected);

        RTMONITOR_API.onconnect(rtmonitor_connected);

        draw_stops(params.stops);

        // create a timer to update the progress indicators every second
        progress_timer = setInterval( timer_update,
                                           1000);

        do_load();
    };

    /*this.reload = function() {
        log("Running StationBoard.reload", config.container);
        this.do_load();
    }*/

function do_load()
{
    log("Running StopBusMap.do_load", config.container);
    log("StopBusMapMap.do_load done", config.container);
};

function rtmonitor_disconnected()
{
    log('stop_bus_map rtmonitor_disconnected');
    document.getElementById(config.container+'_connection').style.display = 'inline-block';
}

function rtmonitor_connected()
{
    log('stop_bus_map rtmonitor_connected');
    document.getElementById(config.container+'_connection').style.display = 'none';
    subscribe();
};

function subscribe()
{
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

    var request_status = RTMONITOR_API.subscribe(config.container,
                                                 request_id,
                                                 request,
                                                 handle_records);

    log('stop_bus_map request_status '+request_status.status);
}

// We have received data from a previously unseen sensor, so initialize
function create_sensor(msg, clock_time)
{
    // new sensor, create marker
    log('stop_bus_map ** New '+msg[RECORD_INDEX]);

    var sensor_id = msg[RECORD_INDEX];

    var sensor = { sensor_id: sensor_id,
                   msg: msg,
                 };

    var marker_icon = create_sensor_icon(msg);

    sensor['marker'] = L.Marker.movingMarker([[msg[RECORD_LAT], msg[RECORD_LNG]],
                                                   [msg[RECORD_LAT], msg[RECORD_LNG]]],
                                                  [1000],
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
                  //log("marker click handler");
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

            if (params.breadcrumbs && map.getBounds().contains(L.latLng(pos)))
            {
                add_breadcrumb(sensor);
            }

            var marker = sensors[sensor_id].marker;
		    marker.moveTo([pos.lat, pos.lng], [1000] );
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
            log('culling '+sensor_id);
            delete sensors[sensor_id];

            if (progress_indicators[sensor_id])
            {
                //log('draw_progress_indicator removing layer '+sensor_id);
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

    //log('draw_progress_indicator '+sensor_id);

    // Remove old progress indicator
    if (progress_indicators[sensor_id])
    {
        //log('draw_progress_indicator removing layer '+sensor_id);
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

        //log(sensor_id+' at '+(new Date())+' vs '+msg.received_timestamp);

        var bus_speed = 7; // m/s

        var time_delta = ((new Date()).getTime() - sensor.msg.received_timestamp.getTime()) / 1000;

        var progress_distance = Math.max(20, time_delta * bus_speed);

        //log('progress_distance '+sensor_id+' '+Math.round(time_delta*10)/10+'s '+Math.round(progress_distance)+'m';

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
        log('update_old_status OLD '+sensor.msg[RECORD_INDEX]);
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
    log('handle_records'+incoming_data['request_data'].length);
    for (var i = 0; i < incoming_data[RECORDS_ARRAY].length; i++)
    {
	    handle_msg(incoming_data[RECORDS_ARRAY][i], new Date());
    }
} // end function handle_records

function log(str)
{
    //console.log(str); return;
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_bus_map_log') >= 0)
    {
        console.log(str);
    }
}

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
    log('drawing '+stops.length+' stops');
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

// END of 'class' StopBusMap
}

