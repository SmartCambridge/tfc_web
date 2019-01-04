"use strict";
// ***************************************************************************
// *******************  Page and map code ************************************
// ***************************************************************************
// Constants


// All supplied from rtroute_config.js
// var RTMONITOR_URI = '';
// var TIMETABLE_URI = '';
// var STOP_API
// var STOPS_API
// var API_KEY = '';

var DEBUG = '';

var STOP_MAX_JOURNEYS = 20; // max # of journeys to request from transport api (i.e. nresults)

var LOG_TRUNCATE = 200; // we'll limit the log to this many messages

var MAP_CENTER = [52.20563, 0.11798];//[52.205, 0.119];
var MAP_SCALE = 13;//15;

var OLD_TIMER_INTERVAL = 30; // watchdog timer interval (s) checking for old data records
var OLD_DATA_RECORD = 60; // time (s) threshold where a data record is considered 'old'

var SVGNS = 'http://www.w3.org/2000/svg';

var DRAW_PROGRESS_LEFT_MARGIN = 5;
var DRAW_PROGRESS_RIGHT_MARGIN = 5;
var DRAW_PROGRESS_TOP_MARGIN = 20;
var DRAW_PROGRESS_BOTTOM_MARGIN = 10;

// *************************************************************
// *************************************************************
// Globals
// *************************************************************
// *************************************************************
var map = null;       // Leaflet map
var map_tiles; // map tiles layer

var urlparams = new URLSearchParams(window.location.search);
var debug = urlparams.has('debug');
var mapbounds;

var clock_time; // the JS Date 'current time', either now() or replay_time
var clock_timer; // the intervaltimer to update the clock in real time (not during replay)

var log_div; // page div element containing the log

var page_progress = {}; // All the 'progress' page elements and page-related global vars
//    .div -- page div element to hold progress visualization
//    .svg -- svg element within div for drawn elements
//    .annotations -- array with element for each route segment derived from data segment_index annotations
//       .box -- the svg rect
//    .route_profile -- the route_profile currently being displayed
//
var progress_update_elements = []; // these are the SVG elements we delete and create each update

var PROGRESS_X_START; // pixel dimensions of progress visual route draw area
var PROGRESS_X_FINISH;
var PROGRESS_Y_START;
var PROGRESS_Y_FINISH;

var log_record_odd = true; // binary toggle for alternate log background colors

var log_append = false;

var log_data = false;

// *********************************************************
// RTRoutes globals

// Sensor data - dictionary of sensors by sensor_id
var sensors = {};
// Where each sensor:
// sensor
//    .msg                - the most recent data message received for this sensor
//    .bus_tracker        - function object containing route tracking state
//    .prev_segment_index - memory of previous segment_index for drawing highlight lines on change
//    .route_highlight    - route highlight drawn line
//    .old                - boolean when sensor data is 'old'


// Local dictionary of STOPS keyed on stop_id
// Sample stop record in rtroute_stops:
// { stop_id:'0500CCITY055', lat:52.2114061236, lng:0.10481260687, common_name:'Storey\'s Way'},
// becomes
// stops_cache['0500CCITY055'] = {this stop record}
var stops_cache = {};

var stops_drawn; // boolean whether stops are drawn on map or not

// Local cache dictionary of JOURNEYS keyed on vehicle_journey_id
// Sample journey data record in rtroutes_journeys:
// {vehicle_journey_id:'20-4-_-y08-1-98-T2',order:1,time:'11:22:00',stop_id:'0500SCAMB011'},
// becomes:
// journeys['20-4-_-y08-1-98-T2'] = { route: [ ... {above record} ] }
var journey_cache = {};
var journey_start_times = {}; // holds lists of journeys by start time

var drawn_journeys = {}; // dictionary (by drawn_journey_id_id) of drawn routes, so they can be removed from map

var drawn_stops = {}; // dictionary (by stop_id) of drawn stops so they can be updated/removed from map

// Trip data (from rtroutes_trip.js)
//  { "Delay": "PT0S",
//    "acp_id": "SCCM-19611",
//    "acp_ts": 1511156152,
//    "Bearing": "0",
//    "InPanic": "0",
//    "LineRef": "4",
//    "acp_lat": 52.230381,
//    "acp_lng": 0.159207,
//    "Latitude": "52.2303810",
//    "Longitude": "0.1592070",
//    "Monitored": "true",
//    "OriginRef": "0500SCAMB011",
//    "OriginName": "De La Warr Way",
//    "VehicleRef": "SCCM-19611",
//    "OperatorRef": "SCCM",
//    "DataFrameRef": "1",
//    "DirectionRef": "INBOUND",
//    "DestinationRef": "0500CCITY484",
//    "RecordedAtTime": "2017-11-20T05:35:52+00:00",
//    "ValidUntilTime": "2017-11-20T05:35:52+00:00",
//    "DestinationName": "Drummer Str Stop D3",
//    "PublishedLineName": "4",
//    "VehicleMonitoringRef": "SCCM-19611",
//    "DatedVehicleJourneyRef": "2",
//    "OriginAimedDepartureTime": "2017-11-20T06:02:00+00:00"
//    },

// Message history for socket messages SENT
var rt_send_history =  [];

var rt_history_cursor = 0; // index to allow user scrolling through history

// Data recording
var recorded_records = [];
var recording_on = false;

// Replay
var replay_time; // holds JS Date, current time of replay
var replay_timer; // the JS interval timer for the replay function
var replay_on = false; // Replay mode on|off
var replay_interval = 1; // Replay step interval (seconds)
var replay_speedup = 10; // relative speed of replay time to real time
var replay_index = 0; // current index into replay data
var replay_errors = 0; // simple count of errors during replay
var replay_stop_on_error = false; // stop the replay if annotation doesn't match analysis

// Segment analysis
var analyze = false;

// Batch replay
var batch = false;

// Annotate (i.e. the user adds the 'correct' segments to the data)
var annotate_auto = false;
var annotate_manual = false;

// *********************************************************
// Display options

var breadcrumbs = false; // location 'breadcrumbs' will be dropped as things move

var map_only = false; // page is in "only display map" mode

// Here we define the 'data record format' of the incoming websocket feed
var RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
var RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
var RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
var RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                  // 'ISO8601' = iso-format string
var RECORD_LAT = 'Latitude';      // name of property containing latitude
var RECORD_LNG = 'Longitude';     // name of property containing longitude

// *****************
// Map globals
var ICON_URL = '/static/images/bus-logo.png';

var ICON_IMAGE = new Image();
ICON_IMAGE.src = ICON_URL;

var crumbs = []; // array to hold breadcrumbs as they are drawn

var icon_size = 'L';

var oldsensorIcon = L.icon({
    iconUrl: ICON_URL,
    iconSize: [20, 20]
});

// *************************
// **** Routes stuff

var bus_stop_icon = L.icon({
    iconUrl: '/static/images/bus_stop.png',
    iconSize: [15,40],
    iconAnchor: [3,40]
});

// ************************
// User 'draw polygon' global vars. The polygon must always be drawn CLOCKWISE.
// The code will automatically add a dashed 'close' line to the polygon between the
// last vertex and the first, closing the shape.
// For use in traffic 'zones', the first drawn edge is always selected as the 'start'
// and the midpoint of any other edge can be clicked on to make it the 'finish'.
var poly_draw = false; // true when user is drawing polygon
var poly_start; // first marker of drawn polygon
var poly_markers = [];
var poly_line; // open line around polygon
var poly_line_start; // line between poly points [0]..[1]
var poly_line_close; // line between poly last point and start, closing polygon
var poly_line_finish; // line highlighting edge selected as zone finish
var poly_finish_index; // index of the edge select as zone finish
var poly_mid_markers = []; // markers marking edge midpoints to select zone finish
var poly_mid_marker_close; // edge midpoint for closing line to select zone finish

// *********************************************************************************

var rt_mon; // rtmonitor_api client object

// *********************************************************************************
// *********************************************************************************
// ********************  INIT RUN ON PAGE LOAD  ************************************
// *********************************************************************************
// *********************************************************************************
function rtroute_init()
{
    document.title = 'RTRoute ' + VERSION;

    //initialise page_title
    var page_title_text = document.createTextNode('RTRoute '+VERSION);
    var page_title = document.getElementById('page_title');
    // remove existing title if there is one
    while (page_title.firstChild) {
            page_title.removeChild(page_title.firstChild);
    }
    document.getElementById('page_title').appendChild(page_title_text);

    // initialize log 'console'
    log_div = document.getElementById('log_div');

    // display RTMONITOR_URI on control div
    var rtmonitor_uri_input = document.getElementById('rtmonitor_uri');

    rtmonitor_uri_input.value = RTMONITOR_URI;

    rtmonitor_uri_input.addEventListener('focus', function (e) {
        rtmonitor_uri_input.style['background-color'] = '#ddffdd'; //lightgreen
        return false;
    });

    rtmonitor_uri_input.addEventListener('blur', function (e) {
        RTMONITOR_URI = rtmonitor_uri_input.value;
        RTMONITOR_API.set_uri(RTMONITOR_URI);
        log('RTMONITOR_URI changed to '+RTMONITOR_URI);
        rtmonitor_uri_input.style['background-color'] = '#ffffff'; //white
        return false;
    });

    rtmonitor_uri_input.addEventListener('keydown', function (e) {
        if (e.key === "Enter" || e.keyCode == 13 || e.which == 13)
        {
            RTMONITOR_URI = rtmonitor_uri_input.value;
            RTMONITOR_API.set_uri(RTMONITOR_URI);
            log('RTMONITOR_URI changed to '+RTMONITOR_URI);
            rtmonitor_uri_input.blur();
            e.preventDefault();
            return false;
        }
        return false;
    });

    // initialize progress div
    page_progress.div = document.getElementById('progress_div');

    page_progress.svg = document.createElementNS(SVGNS, 'svg');
    page_progress.svg.setAttribute('width',page_progress.div.clientWidth);
    page_progress.svg.setAttribute('height',page_progress.div.clientHeight);

    page_progress.div.appendChild(page_progress.svg);
    PROGRESS_X_START = DRAW_PROGRESS_LEFT_MARGIN;
    PROGRESS_X_FINISH = page_progress.div.clientWidth - DRAW_PROGRESS_RIGHT_MARGIN;
    PROGRESS_Y_START = DRAW_PROGRESS_TOP_MARGIN;
    PROGRESS_Y_FINISH = page_progress.div.clientHeight - DRAW_PROGRESS_BOTTOM_MARGIN;


    // initialize map

    var map_options = { preferCanvas: true };

    if (map) {
        map.remove();
    }

    map = L.map('map', map_options)
            .setView(MAP_CENTER, MAP_SCALE);

    map.on('click',click_map);

    map_tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

    mapbounds = map.getBounds();

    // initialize clock

    update_clock(new Date());
    clock_timer = setInterval(function () { update_clock(new Date()); }, 1000);

    // initialize UI checkboxes

    document.getElementById('log_append').checked = false;
    document.getElementById('breadcrumbs').checked = false;

    // watchdog timer checking for 'old' data records

    setInterval(check_old_records, OLD_TIMER_INTERVAL*1000);

    // listener to detect ESC 'keydown' while in map_only mode to escape back to normal
    document.onkeydown = function(evt) {
            evt = evt || window.event;
            if (map_only && evt.keyCode == 27) // ESC to escape from map-only view
            {
                page_normal();
            }
            else if (evt.keyCode == 9) // TAB for replay_step
            {
                evt.preventDefault();
                replay_step();
            }
    };

    // RTROUTE STUFF

    // build stops dictionary keyed on stop_id
    load_stops();

    get_api_stops({ lng: 0.027311, lat: 52.179541 }, { lng: 0.154821, lat: 52.243031}, handle_api_stops);

    // build journeys dictionary keyed on vehicle_journey_id
    load_journeys();

    //draw_stops(stops_cache);

    draw_progress_init();

    load_tests();

    rt_mon = RTMONITOR_API.register(rtmonitor_connected,rtmonitor_disconnected);

    rt_mon.connect();

} // end rtroute_init()

// *********************************************************************************
// ************* RTRoute code      ***************************************************
// *********************************************************************************

function handle_api_stops(api_response)
{
    var api_data;
    try
    {
        api_data = JSON.parse(api_response);
    }
    catch (e)
    {
        console.log('handle_api_stops: failed to parse API response');
        console.log(api_response);
        return;
    }

    if (!api_data.results)
    {
        console.log('handle_api_stops: null results');
        console.log(api_response);
        return;
    }

    if (!api_data.results[0])
    {
        console.log('handle_api_stops: empty results');

        alert('No stops found');

        return;
    }

    console.log('handle_api_stops: processing '+api_data.results.length+' stops');

    for (var i=0; i<api_data.results.length; i++)
    {
    }
}

// Load the rtroute_stops array (from rtroute_stops.js) into stops dictionary
function load_stops()
{
    stops_cache = {};

    for (var i=0; i<rtroute_stops.length; i++)
    {
        load_stop(rtroute_stops[i]);
    }
}

function load_stop(stop)
{
    if (!stop.stop_id)
    {
        stop.stop_id = stop['atco_code'];
    }

    stop.lat = stop['latitude'];

    stop.lng = stop['longitude'];

    var bus_stop_marker = L.marker([stop.lat, stop.lng],
                                   {icon: bus_stop_icon});
    var popup = L.popup({ closeOnClick: false,
                          autoClose: false,
                          offset: L.point(0,-25)})
        .setContent(stop_content(stop));

    bus_stop_marker.bindPopup(popup);
    stop.marker = bus_stop_marker;
    stops_cache[stop.stop_id] = stop;
}

function stops_cache_miss(stop_id)
{
    return !stops_cache.hasOwnProperty(stop_id);
}

function load_stop(stop)
{
    if (!stop.stop_id)
    {
        stop.stop_id = stop['atco_code'];
    }

    stop.lat = stop['latitude'];

    stop.lng = stop['longitude'];

    var bus_stop_marker = L.marker([stop.lat, stop.lng],
                                   {icon: bus_stop_icon});
    var popup = L.popup({ closeOnClick: false,
                          autoClose: false,
                          offset: L.point(0,-25)})
        .setContent(stop_content(stop));

    bus_stop_marker.bindPopup(popup);
    stop.marker = bus_stop_marker;
    stops_cache[stop.stop_id] = stop;
}

function stops_cache_miss(stop_id)
{
    return !stops_cache.hasOwnProperty(stop_id);
}

// Load the rtroute_journeys array (from rtroute_journeys.js) into journeys dictionary
// journey
//   .route = [
//      {vehicle_journey_id:'20-4-_-y08-1-98-T2',order:1,time:'11:22:00',stop_id:'0500SCAMB011'},
//      ...
//      ]
function load_journeys()
{
    journey_cache = {};
    journey_start_times = {};

    var journeys_count = 0;

    // Iterate through all the vehicle_journey_id/stop_id/time/order... records
    for (var i=0; i<rtroute_journeys.length; i++)
    {
        var journey_stop = rtroute_journeys[i];
        var stop_index = journey_stop.order - 1; // order goes 1..n, stop_index starts at 0
        var vehicle_journey_id = journey_stop.vehicle_journey_id;
        var stop = stops_cache[journey_stop.stop_id];

        // For a given row of that data, either create a new journey or add to existing
        if (journey_cache.hasOwnProperty(vehicle_journey_id))
        {
            var journey = journey_cache[vehicle_journey_id];

            // Add this journey row to an existing journey in dictionary
            journey.route[stop_index] = journey_stop;
        }
        else
        {
            //console.log('Starting new journey with '+JSON.stringify(journey_stop));

            // Create a new journey entry with this vehicle_journey_id
            // Start with route of just this current stop
            var new_route = [];
            new_route[stop_index] = journey_stop;

            var journey_id = journey_stop.vehicle_journey_id;

            // Add this route to a new journey_cache entry
            journey_cache[journey_id] = {route: new_route};

            journeys_count++; // keep track of total number of journey_cache

            // Add this journey to the journey_start_time dictionary
            //
            var journey_start_time = journey_stop.time;

            if (journey_start_times.hasOwnProperty(journey_start_time))
            {
                //console.log('Additional journey '+journey_id+' at start time '+journey_start_time);

                // Existing start time, so append this vehicle_journey_id
                journey_start_times[journey_start_time].push(journey_id);
            }
            else
            {
                // New start time, so create entry with list of just this journey_id
                journey_start_times[journey_start_time] = [ journey_id ];
            }
        }
    }
    //log(journeys_count + ' journeys created');

    // will log an analysis of the full list of journeys loaded e.g. how many duplicates
    //print_timetable(journey_start_times);
}

// Development tool print journey start times
function print_timetable(journey_start_times)
{
    // For development see how many journeys are exact duplicates
    //
    var unique_journeys = 0;

    console.log('Checking for duplicate journeys in '+
                Object.keys(journey_start_times).length+' start times');

    var print_lines = []; // accumulate start time debug messages to sort and print

    // Iterate through all start times
    for (var start_time in journey_start_times)
    {
        if (journey_start_times.hasOwnProperty(start_time))
        {
            var unique_this_start_time;
            var journey_ids = journey_start_times[start_time][0];

            if (journey_start_times[start_time].length == 1)
            {
                unique_journeys++;
                unique_this_start_time = 1;
            }
            else
            {
                unique_this_start_time = 1;
                unique_journeys++; // for the first journey at this start time
                // For this start time, iterate through additional journeys
                for (var j=1; j<journey_start_times[start_time].length; j++)
                {
                    journey_ids += ' '+journey_start_times[start_time][j];

                    if (unique_journey(journey_start_times[start_time],j))
                    {
                        unique_journeys++;
                        unique_this_start_time++;
                        // If this jounrney different than others at this start time then print
                        //console.log(start_time+' '+
                        //            journey_to_string(journey_start_times[start_time][j]));
                    }
                }
            }
            // If multiple different journeys at this start time then print the first
            //if (unique_this_start_time>1)
            //{
            //    console.log(start_time+' '+
            //                journey_to_string(journey_start_times[start_time][0]));
            //}

            print_lines.push('Start '+start_time+
                        ' ('+unique_this_start_time+' unique) '+
                        journey_ids
                       );
        }
    }
    console.log('Total unique journeys: '+unique_journeys);
    console.log(print_lines.sort().join('\n'));

}

// return true if journey_ids[index] is unique journey compared to journey_ids[0..index-1]
function unique_journey(journey_ids, index)
{
    for (var i=0; i<index; i++)
    {
        if (same_journey(journey_ids[i],journey_ids[index]))
        {
            return false;
        }
    }
    return true;
}

// return true if journey_id_a and journey_id_b represent the same route
function same_journey(journey_id_a, journey_id_b)
{
    var route_a = journey_cache[journey_id_a].route;
    var route_b = journey_cache[journey_id_b].route;

    if (route_a.length != route_b.length)
    {
        return false;
    }

    for (var i=0; i<route_a.length; i++)
    {
        if (route_a[i].time != route_b[i].time)
        {
            return false;
        }

        if (route_a[i].stop_id != route_b[i].stop_id)
        {
            return false;
        }
    }

    //console.log('Identical journeys '+journeys[journey_id_a].route[0].time+
    //            ' '+journey_id_a+
    //            ' '+journey_id_b);
    return true;
}

function journey_to_string(journey_id)
{
    var route = journey_cache[journey_id].route;
    var str = journey_id;
    for (var i=0; i<route.length; i++)
    {
        str += ' { '+route[i].time+', '+route[i].stop_id+'}';
    }
    return str;
}

// Create the control pane 'test buttons'
function load_tests()
{
    // get DIV to add buttons to
    var test_buttons = document.getElementById('test_buttons');

    // clear out existing test buttons
    while (test_buttons.firstChild) {
            test_buttons.removeChild(test_buttons.firstChild);
    }

    for (var test_name in test_sirivm_journey)
    {
        if (test_sirivm_journey.hasOwnProperty(test_name))
        {
            var test_button = document.createElement('input');
            test_button.setAttribute('type', 'button');
            test_button.setAttribute('class', 'test_button');
            test_button.setAttribute('value', test_name);
            test_button.onclick = (function (x)
                                   {
                                       return function () { load_test_sirivm_journey(x); };
                                   }
                                  )(test_name);

            test_buttons.appendChild(test_button);
        }
    }
}

// ************************************************************************************
// ************************    TRANSPORT API         **********************************
// ************************************************************************************

// Call the API to get the atco_code -> stop info
function get_api_stop_info(stop_id)
{
    var datetime_from = hh_mm_ss(new Date());

    var uri = STOP_API+encodeURIComponent(stop_id)+'/';

    console.log('get_api_stop_info: getting '+stop_id);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    if (API_KEY) {
        xhr.setRequestHeader('Authorization', 'Token ' + API_KEY);
    }

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            //console.log('got route profile for '+sensor_id);
            add_api_stop_info(stop_id, xhr.responseText);
        }
    }
}

// Update a stop.info property with the data from the transport API
function add_api_stop_info(stop_id, api_response)
{
    var api_data;
    try
    {
        api_data = JSON.parse(api_response);
    }
    catch (e)
    {
        console.log('add_api_stop_info: failed to parse API response for '+stop_id);
        console.log(api_response);
        return;
    }

    var stop = stops_cache[stop_id];

    if (!stop)
    {
        console.log('add_api_stop_info: '+stop_id+' not in cache');
        return;
    }

    alert(api_response);
}

// Call the API to get the bounding_box -> stops list
function get_api_stops(sw,ne,callback)
{
    var qs='?bounding_box='+sw.lng+','+sw.lat+','+ne.lng+','+ne.lat;

    var uri = STOPS_API+qs;

    console.log('get_api_stops: getting ',sw,ne);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    if (API_KEY) {
        xhr.setRequestHeader('Authorization', 'Token ' + API_KEY);
    }

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            //console.log('got route profile for '+sensor_id);
            callback(xhr.responseText);
        }
    }
}

// Call the API to get the journeys through a given stop
function get_api_stop_journeys(stop_id)
{
    var datetime_from = hh_mm_ss(new Date());

    var qs = '?stop_id='+encodeURIComponent(stop_id);
    qs += '&datetime_from='+encodeURIComponent(datetime_from);
    qs += '&expand_journey=true';
    qs += '&nresults='+STOP_MAX_JOURNEYS;

    var uri = TIMETABLE_URI+'/journeys_by_time_and_stop/'+qs;

    console.log('get_api_stop_journeys: getting '+stop_id+
                ' @ '+datetime_from);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    if (API_KEY) {
        xhr.setRequestHeader('Authorization', 'Token ' + API_KEY);
    }

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            //console.log('got route profile for '+sensor_id);
            add_api_stop_journeys(stop_id, datetime_from, xhr.responseText);
            handle_stop_journeys(stop_id);
        }
    }
}

// Update a stop.journeys property with the data from the transport API
function add_api_stop_journeys(stop_id, datetime_from, api_response)
{
    var api_data;
    try
    {
        api_data = JSON.parse(api_response);
    }
    catch (e)
    {
        console.log('add_api_stop_journeys: failed to parse API response for '+
                    stop_id+' @ '+datetime_from);
        console.log(api_response);
        return;
    }

    var stop = stops_cache[stop_id];

    if (!stop)
    {
        console.log('add_api_stop_journeys: '+stop_id+' not in cache');
        return;
    }

    if (!api_data.results)
    {
        console.log('add_api_stop_journeys: null results for '+
                    stop_id+' @ '+datetime_from);
        console.log(api_response);
        stop.journeys = null;
        return;
    }

    if (!api_data.results[0])
    {
        console.log('add_api_stop_journeys: empty results for '+
                    stop_id+' @ '+datetime_from);
        stop.journeys = [];

        alert('No journey found for '+stop_id + ' @ '+datetime_from);

        return;
    }

    console.log('add_api_stop_journeys: processing '+api_data.results.length+' journeys');

    stop.journeys = [];

    for (var i=0; i<api_data.results.length; i++)
    {
        var journey_stops = api_data.results[i].journey.timetable.length;

        var journey = new Array(journey_stops);

        for (var j=0; j<journey_stops; j++)
        {
            journey[j] = api_data.results[i].journey.timetable[j].stop;

            if (journey[j].id)
            {
                journey[j].stop_id = journey[j].id;
            }
            journey[j].time = api_data.results[i].journey.timetable[j].time;

            // add this stop to stops_cache if it's not already in there
            if (!stops_cache.hasOwnProperty(journey[j].stop_id))
            {
                load_stop(journey[j]);
            }

        }
        stop.journeys.push(journey);
    }
}

// Deal with a stop that now has an updated 'journeys' property
//
function handle_stop_journeys(stop_id)
{
    console.log('handle_stop_journeys: '+stop_id+' '+stops_cache[stop_id].journeys.length);

    var stop = stops_cache[stop_id];

    var journeys = stop.journeys;

    hide_journeys();

    for (var i=0; i<journeys.length; i++)
    {
        // using a drawn_journey_id of stop-STOP_ID-N where N is arbitrary index
        draw_journey('stop-'+stop_id+'-'+i,journeys[i]);
    }
}

// Query (GET) the departure_to_journey timetable API using data in sensor.msg
// if draw=true then draw journey on map
function get_route(sensor, draw)
{
    //console.log('get_route '+sensor.sensor_id);

    var sensor_id = sensor.sensor_id;

    // We will see if we find a route in the 'journeys' cache
    var journey = cached_journey(sensor);

    if (journey)
    {
        console.log('get_route()','Found cached journey');
        new_journey(sensor, journey);
        // if draw=true to original call of get_route, then draw this journey
        if (draw)
        {
            draw_journey_profile(sensor);
        }
        return;
    }

    // No route_profile in the cache, so do an API request and process asynchronously
    var stop_id = sensor.msg['OriginRef'];

    var departure_time = sensor.msg['OriginAimedDepartureTime'];

    var qs = '?departure_stop_id='+encodeURIComponent(stop_id);
    qs += '&departure_time='+encodeURIComponent(departure_time);
    qs += '&expand_journey=true';

    var uri = TIMETABLE_URI+'/departure_to_journey/'+qs;

    console.log('get_route: getting '+sensor.sensor_id+
                ' route_profile '+stop_id+' @ '+hh_mm_ss(new Date(departure_time)));

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    if (API_KEY) {
        xhr.setRequestHeader('Authorization', 'Token ' + API_KEY);
    }

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            console.log('get_route()', 'got api journey for '+sensor_id);
            var journey = get_api_journey(sensor_id, stop_id, departure_time, xhr.responseText);
            if (journey)
            {
                console.log('get_route()','have journey, length',journey.length);
                new_journey(sensor, journey);
                console.log('get_route()','after new_journey');
                // if draw=true to original call of get_route, then draw this journey
                if (draw)
                {
                    console.log('get_route()','drawing journey',sensor.bus_tracker.get_journey_profile());
                    draw_journey_profile(sensor);
                }
            }
            else
            {
                log('** no journey found for '+sensor_id);
            }
        }
    }
}

// Convert the data returned by the API into a route_profile
//
function get_api_journey(sensor_id, stop_id, departure_time, api_response)
{
    var api_data;
    try
    {
        api_data = JSON.parse(api_response);
    }
    catch (e)
    {
        console.log('get_api_journey(): failed to parse API response for '+
                    sensor_id+' origin '+stop_id+' @ '+departure_time);
        console.log(api_response);
        return null;
    }

    var sensor = sensors[sensor_id];

    if (!api_data.results)
    {
        console.log('get_api_journey(): null results for '+
                    sensor_id+' origin '+stop_id+' @ '+departure_time);
        console.log(api_response);
        return null;
    }
    if (!api_data.results[0])
    {
        console.log('get_api_journey(): empty results for '+
                    sensor_id+' "'+sensor.msg['LineRef']+'" origin '+stop_id+' @ '+departure_time);
        alert('No journey found for '+
                    sensor_id+' "'+sensor.msg['LineRef']+'" origin '+stop_id+' @ '+departure_time);

        console.log(api_response);
        return null;
    }
    if (api_data.results.length > 1)
    {
        console.log('get_api_journey(): '+
                    api_data.results.length+' results for '+
                    sensor_id+' "'+sensor.msg['LineRef']+'" origin '+stop_id+' @ '+departure_time);
        return null;
    }
    if (!api_data.results[0].timetable)
    {
        console.log('get_api_journey(): no timetable for '+sensor_id);
        console.log(api_response);
        return null;
    }
    return api_data.results[0].timetable;
}

// Now that (possibly asynchronously) we have new route, do
// initial processing of the first message
function new_journey(sensor, journey)
{

    console.log('new_journey()',sensor.sensor_id, journey);

    //draw_journey_profile(sensor);

    sensor.bus_tracker.init_journey(journey);

    // We have a user checkbox to control bus<->segment tracking
    if (analyze)
    {
        draw_progress_init(sensor); // add full route

        draw_progress_update(sensor); // add moving markers

        draw_route_segment(sensor);

        log_analysis(sensor);

        // Auto Annotation - we add calculated segment index to the msg, so we
        // can subsequently save these records and use as annotated data.
        if (annotate_auto)
        {
            sensor.msg.segment_index = [ sensor.bus_tracker.get_segment_index() ];
        }
    }
}

//debug Given a sirivm msg, return the vehicle journey_id
function cached_journey(sensor)
{
    console.log('cached_journey()','seeking for ', sensor.sensor_id, sensor);

    if (sensor.msg['OriginRef'] != '0500SCAMB011')
    {
        return 0;
    }

    switch (sensor.msg['OriginAimedDepartureTime'])
    {
        case '2017-11-20T06:02:00+00:00':
            return journey_cache['20-4-_-y08-1-51-T0'].route;

        case '2017-11-20T06:22:00+00:00':
            return journey_cache['20-4-_-y08-1-1-T0'].route;

        case '2017-11-20T06:42:00+00:00':
            return journey_cache['20-4-_-y08-1-2-T0'].route;

        case '2017-11-20T07:22:00+00:00':
            return journey_cache['20-4-_-y08-1-4-T0'].route;

        case '2017-11-20T07:42:00+00:00':
            return journey_cache['20-4-_-y08-1-5-T0'].route;

        default:
            //log('<span style="color: red">Vehicle departure time not recognized</span>');

    }

    return 0;
}

// return a Leaflet Icon based on a real-time msg
function create_sensor_icon(msg)
{
    console.log('create_sensor_icon '+msg['VehicleRef']);

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

function add_breadcrumb(pos)
{
    if (breadcrumbs)
    {
        var crumb = L.circleMarker([pos.lat, pos.lng], { color: 'blue', radius: 1 }).addTo(map);
        crumbs.push(crumb);
    }
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
            '<br/>'+msg['DirectionRef']+
            '<br/>Delay: ' + xml_duration_to_string(msg['Delay']);
}

function sensor_popup_content(msg)
{
    var time = get_msg_date(msg);
    var time_str = ("0" + time.getHours()).slice(-2)   + ":" +
                   ("0" + time.getMinutes()).slice(-2) + ":" +
                   ("0" + time.getSeconds()).slice(-2);
    var sensor_id = msg[RECORD_INDEX];
    return time_str +
        '<br/>' + sensor_id +
		'<br/>Line "' + msg['PublishedLineName'] +'"'+
        '<br/>'+msg['DirectionRef']+
        '<br/>Delay: ' + xml_duration_to_string(msg['Delay'])+
        '<br/><a href="#" onclick="click_journey('+"'"+sensor_id+"'"+')">journey</a>'+
        '<br/><a href="#" onclick="subscribe_to_sensor('+"'"+sensor_id+"'"+')">subscribe</a>'+
        '<br/><a href="#" onclick="click_more('+"'"+sensor_id+"'"+')">more</a>';
}

// user has clicked on 'more' in the sensor popup
function sensor_more_content(sensor_id)
{
    var sensor = sensors[sensor_id];
    var content = JSON.stringify(sensor.msg).replace(/,/g,', ');
    content +=
        '<br/><a href="#" onclick="click_less('+"'"+sensor_id+"'"+')">less</a>';
    return content;
}

// Initialize the vertical progress visualization
function draw_progress_init(sensor)
{

    // Draw start and finish stop lines
    //
    var start_line = document.createElementNS(SVGNS, 'line');

    var x_start_finish = PROGRESS_X_START + (PROGRESS_X_FINISH - PROGRESS_X_START)*0.75;

    start_line.setAttribute('x1', x_start_finish);
    start_line.setAttribute('y1', PROGRESS_Y_START);
    start_line.setAttribute('x2', PROGRESS_X_FINISH);
    start_line.setAttribute('y2', PROGRESS_Y_START);
    start_line.setAttribute('stroke', 'black');

    page_progress.svg.appendChild(start_line);

    var finish_line = document.createElementNS(SVGNS, 'line');

    finish_line.setAttribute('x1', x_start_finish);
    finish_line.setAttribute('y1', PROGRESS_Y_FINISH);
    finish_line.setAttribute('x2', PROGRESS_X_FINISH);
    finish_line.setAttribute('y2', PROGRESS_Y_FINISH);
    finish_line.setAttribute('stroke', 'black');

    page_progress.svg.appendChild(finish_line);

    // Get basic route info from route_profile
    //
    if (!sensor || !sensor.bus_tracker)
    {
        return;
    }

    var route_profile = sensor.bus_tracker.get_journey_profile();

    if (!route_profile)
    {
        return;
    }

    var route_distance = route_profile[route_profile.length-1].distance;

    // Draw the vertical route outline
    //
    var x1 = PROGRESS_X_START + (PROGRESS_X_FINISH - PROGRESS_X_START)*0.8;
    var x2 = PROGRESS_X_FINISH;
    var w = x2 - x1;

    for (var i=1; i<route_profile.length-1;i++)
    {
        var stop_distance = route_profile[i].distance;
        var y = Math.floor(stop_distance / route_distance
                            * (PROGRESS_Y_FINISH - PROGRESS_Y_START)
                            + PROGRESS_Y_START);

        var line = document.createElementNS(SVGNS,'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'black');
        page_progress.svg.appendChild(line);
    }

    // draw segment analysis boxes
    // create page_progress 'globals' needed for draw and update of page
    page_progress.annotations = new Array(route_profile.length+1);
    page_progress.route_profile = route_profile;

    for (var i=0; i<route_profile.length+1;i++)
    {
        add_annotation(i);
    }
}

// Update the visual progress visualization
function draw_progress_update(sensor)
{
    // Get basic route info from route_profile
    //
    var route_profile = sensor.bus_tracker.get_journey_profile();

    if (!route_profile)
    {
        return;
    }

    var route_distance = route_profile[route_profile.length-1].distance;

    var x1 = PROGRESS_X_START + (PROGRESS_X_FINISH - PROGRESS_X_START)*0.8;
    var x2 = PROGRESS_X_FINISH;
    var w = x2 - x1;

    // Remove previous update elements
    for (var i=0; i<progress_update_elements.length; i++)
    {
        page_progress.svg.removeChild(progress_update_elements[i]);
    }

    progress_update_elements = [];

    // Highlight the current route segment
    //
    var segment_index = sensor.bus_tracker.get_segment_index();

    var segment_top;

    var segment_height = 0;

    var rect = document.createElementNS(SVGNS,'rect');

    rect.setAttributeNS(null, 'fill', '#88ff88');

    if (segment_index == 0) // not started route
    {
        segment_top = PROGRESS_Y_START - 10;

        rect.setAttributeNS(null, 'x', x1);
        rect.setAttributeNS(null, 'y', segment_top);
        rect.setAttributeNS(null, 'width', w);
        rect.setAttributeNS(null, 'height', 9);

        page_progress.svg.appendChild(rect);
    }
    else if (segment_index == route_profile.length) // finished route
    {
        segment_top = PROGRESS_Y_FINISH + 1;

        rect.setAttributeNS(null, 'x', x1);
        rect.setAttributeNS(null, 'y', segment_top);
        rect.setAttributeNS(null, 'width', w);
        rect.setAttributeNS(null, 'height', 9);

        page_progress.svg.appendChild(rect);
    }
    else
    {
        var stop_distance = route_profile[segment_index - 1].distance;
        segment_top = Math.floor(stop_distance / route_distance
                            * (PROGRESS_Y_FINISH - PROGRESS_Y_START)
                            + PROGRESS_Y_START);

        stop_distance = route_profile[segment_index].distance;
        var y1 = Math.floor(stop_distance / route_distance
                            * (PROGRESS_Y_FINISH - PROGRESS_Y_START)
                            + PROGRESS_Y_START);

        segment_height = y1 - segment_top;

        rect.setAttributeNS(null, 'x', x1);
        rect.setAttributeNS(null, 'y', segment_top);
        rect.setAttributeNS(null, 'width', w);
        rect.setAttributeNS(null, 'height', segment_height-1);

        page_progress.svg.appendChild(rect);
    }

    progress_update_elements.push(rect);

    // Draw segment progress line
    //
    var segment_progress_y = segment_top + sensor.bus_tracker.get_segment_progress() * segment_height;

    var segment_progress_x = PROGRESS_X_START + (PROGRESS_X_FINISH - PROGRESS_X_START)*0.65;

    var progress_line = document.createElementNS(SVGNS, 'line');

    progress_line.setAttribute('x1', segment_progress_x);
    progress_line.setAttribute('y1', segment_progress_y);
    progress_line.setAttribute('x2', PROGRESS_X_FINISH);
    progress_line.setAttribute('y2', segment_progress_y);
    progress_line.setAttribute('stroke', 'black');

    page_progress.svg.appendChild(progress_line);

    progress_update_elements.push(progress_line);

    var progress_icon = document.createElementNS(SVGNS, 'image');

    progress_icon.setAttributeNS('http://www.w3.org/1999/xlink','href', ICON_URL);
    progress_icon.setAttributeNS(null, 'x', segment_progress_x - 9);
    progress_icon.setAttributeNS(null, 'y', segment_progress_y - 9);
    progress_icon.setAttributeNS(null, 'width', 20);
    progress_icon.setAttributeNS(null, 'height', 20);

    page_progress.svg.appendChild(progress_icon);
    progress_update_elements.push(progress_icon);

    // update segment annotations
    update_annotations(sensor.msg);

    // Draw segment_index progress indicator next to annotation boxes
    update_annotation_pointer(sensor.msg, segment_index);
}

// Given a sensor.segment_index, draw a green line on route segment
// and delete the previous line if needed.
function draw_route_segment(sensor)
{
    // highlight line on map of next route segment
    //
    var segment_index = sensor.bus_tracker.get_segment_index();

    if (segment_index == null)
    {
        return;
    }

    if (segment_index != sensor.prev_segment_index)
    {
        sensor.prev_segment_index = segment_index;

        // if prior map highlight exists, remove it
        if (sensor.route_highlight)
        {
            map.removeLayer(sensor.route_highlight);
        }

        var route_profile = sensor.bus_tracker.get_journey_profile();

        if (!route_profile)
        {
            return;
        }

        // If pre-start of route, highlight first stop
        if (segment_index == 0)
        {
            var stop = route_profile[segment_index];
            sensor.route_highlight = draw_circle(stop, 40, 'green');
        }
        // If post-finish on route, highlight last stop
        else if (segment_index == route_profile.length)
        {
            var stop = route_profile[segment_index-1];
            sensor.route_highlight = draw_circle(stop, 40, 'green');
        }
        else
        {
            var prev_stop = route_profile[sensor.bus_tracker.get_segment_index()-1];
            var stop = route_profile[sensor.bus_tracker.get_segment_index()];
            sensor.route_highlight = draw_line(prev_stop, stop, 'green');
        }
    }
}

// color in the annotation boxes on the progress visualization
function update_annotations(msg)
{
    // we color the boxes green if they are in the 'annotated' segment_index of the msg
    for (var i=0; i<page_progress.annotations.length; i++)
    {
        if (msg.segment_index && msg.segment_index.includes(i))
        {
            page_progress.annotations[i].box.setAttributeNS(null,'fill','#88ff88');
        }
        else
        {
            page_progress.annotations[i].box.setAttributeNS(null,'fill','white');
        }
    }
}

// Add an 'annotation' box to the progress visualization
function add_annotation(segment_index)
{
    var x = DRAW_PROGRESS_LEFT_MARGIN + 10;
    var box_height = 10; // height of segment box (px)
    var box_width = 10;
    var box_top_margin = 3; // vertical space between boxes

    var y = DRAW_PROGRESS_TOP_MARGIN + segment_index*(box_height+box_top_margin);
    var box = document.createElementNS(SVGNS,'rect');
    box.setAttributeNS(null, 'x', x);
    box.setAttributeNS(null, 'y', y);
    box.setAttributeNS(null, 'height', box_height);
    box.setAttributeNS(null, 'width', box_width);
    box.setAttributeNS(null, 'stroke', 'black');
    box.setAttributeNS(null, 'fill', 'white');
    box.addEventListener('mouseover', function () { annotate_mouseover(segment_index); });
    box.addEventListener('mouseout', function () {annotate_mouseout(segment_index); });
    box.addEventListener('click', function () {annotate_click(segment_index); });
    page_progress.svg.appendChild(box);
    page_progress.annotations[segment_index] = { box: box };
}

// Draw the 'progress indicator' for current segment_index adjacent to
// the annotation boxes in the progress visualization
function update_annotation_pointer(msg, segment_index)
{
    var x = DRAW_PROGRESS_LEFT_MARGIN + 2;
    var box_height = 10; // height of segment box (px)
    var box_width = 10;
    var box_top_margin = 3; // vertical space between boxes
    var y = DRAW_PROGRESS_TOP_MARGIN + segment_index*(box_height+box_top_margin);

    // if there's an existing segment pointer, remove that one
    if (page_progress.annotation_pointer)
    {
        page_progress.svg.removeChild(page_progress.annotation_pointer);
    }
    // Create pointer triangle pointing at the segment annotation box
    page_progress.annotation_pointer = document.createElementNS(SVGNS,'polygon');
    var points = x+','+y+' ';
    points += x+','+(y+box_height)+' ';
    points += (x+8)+','+(y + box_height/2);
    page_progress.annotation_pointer.setAttributeNS(null, 'points', points);
    var pointer_color = 'yellow';
    if (msg.segment_index)
    {
        if (msg.segment_index.includes(segment_index))
        {
            pointer_color ='green';
        }
        else
        {
            pointer_color = 'red';
        }
    }
    page_progress.annotation_pointer.setAttributeNS(null, 'fill', pointer_color);
    page_progress.svg.appendChild(page_progress.annotation_pointer);
}

// User hovers mouse in/out of annotation box
function annotate_mouseover(segment_index)
{
    if (page_progress.highlight_segment)
    {
        map.removeLayer(page_progress.highlight_segment);
    }
    if (segment_index == 0)
    {
        page_progress.highlight_segment = draw_circle(page_progress.route_profile[segment_index],
                                                      40,
                                                      'yellow');
    } else if (segment_index == page_progress.route_profile.length)
    {
        page_progress.highlight_segment = draw_circle(page_progress.route_profile[segment_index-1],
                                                      40,
                                                      'yellow');
    }
    else
    {
        page_progress.highlight_segment = draw_line(page_progress.route_profile[segment_index-1],
                                                    page_progress.route_profile[segment_index],
                                                    'yellow');
    }
}

// User mouse has moved out of annotation box so de-highlight segment
function annotate_mouseout(segment_index)
{
    if (page_progress.highlight_segment)
    {
        map.removeLayer(page_progress.highlight_segment);
    }
}

//User has clicked on annotation box, so update msg segment_index annotation (if annotate_manual)
function annotate_click(segment_index)
{
    if (annotate_manual)
    {
        var msg = recorded_records[replay_index-1];
        if (!msg.segment_index)
        {
            // if no segment_index property in data record then create [ segment_index ]
            msg.segment_index = [ segment_index ];
        }
        else if (!msg.segment_index.includes(segment_index))
        {
            // if existing segment_index array but not including this entry then add
            msg.segment_index.push(segment_index);
        }
        else
        {
            // if existing segment_index array including this entry then remove
            var segments = [];
            for (var i=0; i < msg.segment_index.length; i++)
            {
                if (msg.segment_index[i] != segment_index)
                {
                    segments.push(msg.segment_index[i]);
                }
            }
            msg.segment_index = segments;
        }
        update_annotations(msg);
    }
}

// ********************************************************************************
// ********************************************************************************
// ***********  Process the data records arrived from WebSocket or Replay *********
// ********************************************************************************
// ********************************************************************************

// Process websocket data
function handle_records(websock_data)
{
    //console.log(websock_data);
    //var incoming_data = JSON.parse(websock_data);
    //console.log('handle_records'+json['request_data'].length);
    for (var i = 0; i < websock_data[RECORDS_ARRAY].length; i++)
    {
	    handle_msg(websock_data[RECORDS_ARRAY][i], new Date());
    }
} // end function handle_records

// Process replay data relevant to updated 'replay_time'
// 'replay_index' will be updated to point to NEXT record in recorded_records
function replay_timestep()
{
    // move replay_time forwards by the current timestep
    replay_time.setSeconds(replay_time.getSeconds() + replay_interval*replay_speedup);

    update_clock(replay_time);

    while ( replay_index < recorded_records.length &&
            get_msg_date(recorded_records[replay_index]) < replay_time)
    {
        var msg = recorded_records[replay_index];

        var time_str = hh_mm_ss(get_msg_date(msg));

        handle_msg(msg, replay_time);

        replay_index++;
    }

    if (replay_index == recorded_records.length)
    {
        log('Replay completed, errors: '+replay_errors);
        replay_stop();
    }
}

// User has clicked the 'step' button so jump forwards to the next record.
function replay_next_record()
{
    // do nothing if we've reached the end of recorded_records
    if (replay_index >= recorded_records.length)
    {
        log('Replay completed, errors: '+replay_errors);
        return;
    }

    console.log('replaying record '+replay_index);

    var msg = recorded_records[replay_index++];

    replay_time = get_msg_date(msg);

    update_clock(replay_time);

    handle_msg(msg, replay_time);
}

// Replay ALL records in a single batch
function replay_batch()
{
    if (replay_index >= recorded_records.length)
    {
        replay_index = 0;
        replay_errors = 0;
    }

    while (replay_index < recorded_records.length)
    {
        var prev_replay_errors = replay_errors;
        // get the next record to process
        var msg = recorded_records[replay_index++];
        // update the displayed clock with time of this data record
        replay_time = get_msg_date(msg);
        update_clock(replay_time);
        // Process this data record
        handle_msg(msg, replay_time);
        // replay_errors will have been updated
        if (replay_stop_on_error && prev_replay_errors != replay_errors)
        {
            break;
        }
    }

    log('Batch replay paused/completed, errors: '+
        replay_errors+"/"+recorded_records.length+
        ' ('+Math.floor(1000*replay_errors/recorded_records.length)/10+'%)');
}

// process a single data record
function handle_msg(msg, clock_time)
{
    // add to recorded_data if recording is on

    if (recording_on)
    {
        recorded_records.push(JSON.stringify(msg));
    }

    var sensor_id = msg[RECORD_INDEX];

    // If an existing entry in 'sensors' has this key, then update
    // otherwise create new entry.
    if (sensors.hasOwnProperty(sensor_id))
    {
        update_sensor(msg, clock_time);
    }
    else
    {
        init_sensor(msg, clock_time);
    }
}

// We have received data from a previously unseen sensor, so initialize
function init_sensor(msg, clock_time)
    {
        // new sensor, create marker
        log(' ** New '+msg[RECORD_INDEX]);

        var sensor_id = msg[RECORD_INDEX];

        var sensor = { sensor_id: sensor_id,
                       msg: msg
                     };

        var marker_icon = create_sensor_icon(msg);

        sensor['marker'] = L.Marker.movingMarker([[msg[RECORD_LAT], msg[RECORD_LNG]],
                                                       [msg[RECORD_LAT], msg[RECORD_LNG]]],
                                                      [1000],
                                                      {icon: marker_icon});
        sensor['marker']
            .addTo(map)
            .bindPopup(sensor_popup_content(msg), { className: "sensor-popup"})
            .bindTooltip(tooltip_content(msg), {
                                // permanent: true,
                                className: "sensor-tooltip",
                                interactive: true
                              })
            .on('click', function()
                    {
                      //console.log("marker click handler");
                    })
            .start();

        // flag if this record is OLD or NEW
        init_old_status(sensor, clock_time);

        sensor.bus_tracker = new BusTracker();

        sensor.bus_tracker.init(msg, clock_time);

        sensors[sensor_id] = sensor;

    }

// We have received a new data message from an existing sensor, so analyze and update state
function update_sensor(msg, clock_time)
{
		// existing sensor data record has arrived
        //console.log('update_sensor '+clock_time);

        var sensor_id = msg[RECORD_INDEX];

		if (get_msg_date(msg).getTime() != get_msg_date(sensors[sensor_id].msg).getTime())
        {
            // move marker
            var pos = get_msg_point(msg);
            var marker = sensors[sensor_id].marker;
		    marker.moveTo([pos.lat, pos.lng], [1000] );
		    marker.resume();

            // update tooltip and popup
		    marker.setTooltipContent(tooltip_content(msg));
		    marker.setPopupContent(sensor_popup_content(msg));

            // store as latest msg
            // moving current msg to prev_msg
            sensors[sensor_id].prev_msg = sensors[sensor_id].msg;
		    sensors[sensor_id].msg = msg; // update entry for this msg
            add_breadcrumb(pos);

            var sensor = sensors[sensor_id];

            //console.log('Updating '+sensor.sensor_id+', analyze='+analyze);

            // flag if this record is OLD or NEW
            update_old_status(sensor, clock_time);

            // We have a user checkbox to control bus<->segment tracking
            if (analyze)
            {
                sensor.bus_tracker.update(msg);

                draw_route_segment(sensor);

                draw_progress_update(sensor);

                log_analysis(sensor);
            }

            // Auto Annotation - we add calculated segment index to the msg, so we
            // can subsequently save these records and use as annotated data.
            if (annotate_auto)
            {
                sensor.msg.segment_index = [ sensor.bus_tracker.get_segment_index() ];
            }
		}
}

// update realtime clock on page
// called via intervalTimer in init()
function update_clock(time)
{
    clock_time = time;
    document.getElementById('clock').innerHTML = hh_mm_ss(time);
    check_old_records(time);
}

// Given a data record, update '.old' property t|f and reset marker icon
// Note that 'current time' is the JS date value in global 'clock_time'
// so that this function works equally well during replay of old data.
//
function init_old_status(sensor, clock_time)
{
    sensor.old = false; // start with the assumption msg is not old, update will correct if needed
    update_old_status(sensor, clock_time);
}

function update_old_status(sensor, clock_time)
{
    var data_timestamp = get_msg_date(sensor.msg); // will hold Date from sensor

    // calculate age of sensor (in seconds)
    var age = (clock_time - data_timestamp) / 1000;

    if (age > OLD_DATA_RECORD)
    {
        // data record is OLD
        // skip if this data record is already flagged as old
        if (sensor.old != null && sensor.old)
        {
            return;
        }
        // set the 'old' flag on this record and update icon
        sensor.old = true;
        sensor.marker.setIcon(oldsensorIcon);
    }
    else
    {
        //console.log('update_old_status NOT OLD '+sensor.sensor_id);
        //var clock_time_str = hh_mm_ss(clock_time);
        //var msg_time_str = hh_mm_ss(data_timestamp);
        //console.log(clock_time_str+' vs '+msg_time_str+' data record is NOT OLD '+sensor.sensor_id);

        // skip if this data record is already NOT OLD
        if (sensor.old != null && !sensor.old)
        {
            return;
        }
        // reset the 'old' flag on this data record and update icon
        sensor.old = false;
        sensor.marker.setIcon(create_sensor_icon(sensor.msg));
    }
}

// watchdog function to flag 'old' data records
// records are stored in 'sensors' object
function check_old_records(clock_time)
{
    //console.log('checking for old data records..,');

    var check_time = new Date();
    if (clock_time != null)
    {
        check_time = clock_time;
    }

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
        //console.log('check_old_records '+sensor_id);
        update_old_status(sensors[sensor_id], check_time);
    }
}

// return provided JS Date() as HH:MM:SS
function hh_mm_ss(datetime)
{
    var hh = ('0'+datetime.getHours()).slice(-2);
    var mm = ('0'+datetime.getMinutes()).slice(-2);
    var ss = ('0'+datetime.getSeconds()).slice(-2);
    return hh+':'+mm+':'+ss;
}

// ***************************************************************************
// *******************  Logging code      ************************************
// ***************************************************************************

function log(msg, format)
{
    if (!format)
    {
        format = 'console';
    }

    // create outermost log record element
    var new_log_record = document.createElement('div');

    if (format == 'console')
    {
        // create HH:MM:SS timestamp for this log record
        var ts = hh_mm_ss(new Date());

        // create timestamp element
        var ts_element = document.createElement('div');
        ts_element.classList.add('log_ts');
        ts_element.innerHTML = ts;
        new_log_record.appendChild(ts_element);
    }

    // create msg element
    var msg_element = document.createElement('div');
    msg_element.classList.add('log_msg');
    msg_element.innerHTML = msg;
    new_log_record.appendChild(msg_element);

    new_log_record.classList.add('log_record');
    // set the log background color and toggle odd/even flag
    new_log_record.classList.add(log_record_odd ? 'log_record_odd' : 'log_record_even');
    log_record_odd = !log_record_odd;

    // if log is full then drop the oldest msg
    if (log_div.childElementCount == LOG_TRUNCATE)
    {
        //console.log('log hit limit '+LOG_TRUNCATE);
        if (log_append)
        {
            //console.log('log removing firstChild');
            log_div.removeChild(log_div.firstChild);
        }
        else
        {
            //console.log('log removing lastChild '+log_div.lastChild.tagName);
            log_div.removeChild(log_div.lastChild);
        }
        //console.log('log record count after removeChild: '+log_div.childElementCount)
    }
    if (log_append)
    {
        log_div.appendChild(new_log_record);
    }
    else
    {
        log_div.insertBefore(new_log_record, log_div.firstChild);
    }
    //console.log('log record count: '+log_div.childElementCount)
}

// Empty the console log div
function log_clear()
{
    while (log_div.firstChild)
    {
            log_div.removeChild(log_div.firstChild);
    }
}

// reverse the order of the messages in the log
function log_reverse()
{
    for (var i=0;i<log_div.childNodes.length;i++)
      log_div.insertBefore(log_div.childNodes[i], log_div.firstChild);
}

// Write messages to in-page log
function log_analysis(sensor)
{
    var annotated_segment_index = sensor.msg.segment_index; // array of 'correct' segment_index values

    if (annotated_segment_index == null)
    {
        log(hh_mm_ss(get_msg_date(sensor.msg))+' segment_index '+sensor.bus_tracker.get_segment_index());
    }
    else
    {
        if (!annotated_segment_index.includes(sensor.bus_tracker.get_segment_index()))
        {
            log('<span style="color: red">'+
                hh_mm_ss(get_msg_date(sensor.msg))+
                ' wrong segment_index '+sensor.bus_tracker.get_segment_index()+
                ' should be '+annotated_segment_index.toString()+
                '</span>');
            // update the global replay 'error' count
            replay_errors++;
        }
    }
}

// return {lat:, lng:} from bus message
function get_msg_point(msg)
{
    return { lat: msg[RECORD_LAT], lng: msg[RECORD_LNG] };
}

// return a JS Date() from bus message
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

// ***************************************************************************
// *******************  RTmonitor calls/callbacks ****************************
// ***************************************************************************

// user has clicked the 'connect' button
function rt_connect()
{
    log('** connecting rtmonitor **');
    rt_mon.connect();
}

// user has clicked the 'close' button
function rt_disconnect()
{
    log('** disconnecting rtmonitor **');
    rt_mon.close();
}

function rtmonitor_disconnected()
{
    log('** rtmonitor connection closed **');
}

function rtmonitor_connected()
{
    log('** rtmonitor connected **');
}

function rt_send_input(input_name)
{
    var str_msg = document.getElementById(input_name).value;

    rt_send_raw(str_msg);
}

function rt_send_raw(str_msg)
{
    log('sending: '+str_msg);

    // push msg onto history and update cursor to point to end
    rt_send_history.push(str_msg);

    rt_history_cursor = rt_send_history.length;

    // write msg into scratchpad textarea
    document.getElementById('rt_scratchpad').value = str_msg;

    rt_mon.raw(JSON.parse(str_msg), handle_records);
}

// ****************************************************************************************
// *************** User interaction functions *********************************************
// ****************************************************************************************

// Draw the (test) stops on the map and provide a custom marker for each with a popup
function draw_stops(stops)
{
    for (var stop_id in stops)
    {
        if (stops.hasOwnProperty(stop_id))
        {
            draw_stop(stops[stop_id]);
        }
    }
    stops_drawn = true;
}

function draw_stop(stop)
{
    drawn_stops[stop.stop_id] = true;
    stop.marker.addTo(map);
}

function hide_stops()
{
    for (var stop_id in drawn_stops)
    {
        if (drawn_stops.hasOwnProperty(stop_id) && drawn_stops[stop_id])
        {
            if (stops_cache[stop_id])
            {
                hide_stop(stops_cache[stop_id]);
            }
        }
    }
    stops_drawn = false;
}

function hide_stop(stop)
{
    drawn_stops[stop.stop_id] = false;
    map.removeLayer(stop.marker);
}

// return a string with the stop popup content, sensor can be null
function stop_content(stop, msg)
{
    var name = stop.common_name;
    var time = stop.time;
    var line = msg ? msg['LineRef'] : '';
    var stop_id = stop.stop_id;
    var lat = Math.floor(stop.lat*100000)/100000;
    var lng = Math.floor(stop.lng*100000)/100000;

    var journey_count = '';

    if (stop.journeys)
    {
        journey_count = ' ('+stop.journeys.length+')';
    }

    return name+'<br/>'+
           (time ? '"'+line+'": '+ time +'<br/>' : '')+
           stop_id+'<br/>'+
           lat+'<br/>'+
           lng+'<br/>'+
           '<a href="#" onclick="click_stop_journeys(\''+stop_id+'\')">journeys</a>' + journey_count+'<br/>'+
           '<a href="#" onclick="click_stop_more(\''+stop_id+'\')">more</a>';
}

function click_stop_journeys(stop_id)
{
    get_api_stop_journeys(stop_id);
}

function click_stop_more(stop_id)
{
    get_api_stop_info(stop_id);
}

// Draw the straight lines between stops on the selected journey
// Updates drawn_journeys[sensor_id] data structure:
// drawn_journeys[sensor_id]
//   .poly_line
//   .arrows
function draw_journey_profile(sensor)
{
    var sensor_id = sensor.sensor_id;

    var route_profile = sensor.bus_tracker.get_journey_profile();

    if (!route_profile)
    {
        console.log('draw_journey_profile: No route_profile for '+sensor_id);
        return;
    }

    // if ANY already drawn, remove them
    hide_journeys();

    hide_stops();

    draw_journey('s-'+sensor_id, route_profile, sensor.msg);

    draw_journey_stops(route_profile);
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
// Here we draw a journey, either from a timetable lookup for a stop, or from the route_profile of an active bus
function draw_journey(drawn_journey_id, journey, msg)
{
    // And simply draw the polyline between the stops
    var poly_line = L.polyline([], {color: 'red'}).addTo(map);

    drawn_journeys[drawn_journey_id] = {}; // create object to hold this routes drawn elements

    drawn_journeys[drawn_journey_id].poly_line = poly_line; // polyline of route drawn on map

    drawn_journeys[drawn_journey_id].arrows = []; // arrows for each segment of the route

    log('Drawing journey '+drawn_journey_id+', length '+journey.length);

    for (var i=0; i<journey.length; i++)
    {
        var stop = stops_cache[journey[i].stop_id];

        stop.time = journey[i].time;

        // update stop popup with time for this journey
        stop.marker.setPopupContent(stop_content(stop, msg));

        // add journey segment to map
        var p = new L.LatLng(stop.lat, stop.lng);
        drawn_journeys[drawn_journey_id].poly_line.addLatLng(p);

        // Add an arrow from previous stop to this stop
        if (i > 0)
        {
            var prev_stop = stops_cache[journey[i - 1].stop_id];
            var diffLat = stop.lat - prev_stop.lat;
            var diffLng = stop.lng - prev_stop.lng;
            var center = [prev_stop.lat + diffLat/2, prev_stop.lng + diffLng/2];
            var angle = (get_bearing(prev_stop, stop)- 90 + 360) % 360;
            drawn_journeys[drawn_journey_id].arrows.push( new L.marker(
                center,
                { icon: new L.divIcon({
                              className : 'arrow_icon',
                              iconSize: new L.Point(30,30),
                              iconAnchor: new L.Point(15,15),
                              html : '<div style = "font-size: 20px;'+
                                  '-webkit-transform: rotate('+ angle +'deg)">&#10152;</div>'
                              })
                }
            ));
            drawn_journeys[drawn_journey_id].arrows[i-1].addTo(map);
        }
    }
}

// User has un-checked 'Show Journey'
function hide_journey(drawn_journey_id)
{
    if (!drawn_journey_id || !drawn_journeys[drawn_journey_id])
    {
        return;
    }

    if (drawn_journeys[drawn_journey_id].poly_line)
    {
        map.removeLayer(drawn_journeys[drawn_journey_id].poly_line);
        for (var i=0; i < drawn_journeys[drawn_journey_id].arrows.length; i++)
        {
            map.removeLayer(drawn_journeys[drawn_journey_id].arrows[i]);
        }
    }
}

// Remove ALL drawn routes
function hide_journeys()
{
    for (var drawn_journey_id in drawn_journeys)
    {
        if (drawn_journeys.hasOwnProperty(drawn_journey_id))
        {
            hide_journey(drawn_journey_id);
        }
    }
}

// Draw the stops along a journey
function draw_journey_stops(journey)
{
    for (var i=0; i<journey.length; i++)
    {
        draw_stop(stops_cache[journey[i].stop_id]);
    }
}

// draw a line between points A and B as {lat:, lng:}
function draw_line(A,B, color)
{
    if (!color) color = 'green';
    var line = L.polyline([[A.lat, A.lng],[B.lat,B.lng]], {color: color}).addTo(map);
    return line;
}

function draw_circle(A,radius,color)
{
    if (!color) color = 'green';
    var circle = L.circle([A.lat, A.lng],radius,{color: color}).addTo(map);
    return circle;
}

// toggle the 'breadcrumbs' function that draws a dot every time a sensor position is received
function click_breadcrumbs()
{
    breadcrumbs = document.getElementById("breadcrumbs").checked == true;
}

// toggle the 'draw_stops' function that draws a stop icon at each stop lat,lng
function click_stops()
{
    if (document.getElementById("draw_stops").checked)
    {
        draw_stops(stops_cache);
    }
    else
    {
        hide_stops();
    }
}

// switch the console log between newest msg on top vs newest on bottom
function click_log_append()
{
    var prev_log_append = log_append;
    log_append = document.getElementById("log_append").checked == true;
    if (prev_log_append != log_append)
    {
        log_reverse();
    }
}

function click_log_data()
{
    log_data = document.getElementById("log_data").checked == true;
}

// remove all markers from map and reset 'sensors' array
function clear_markers()
{
    //console.log('clear_markers');
    for (var sensor_id in sensors)
    {
        if (sensors[sensor_id]['marker'])
        {
            map.removeLayer(sensors[sensor_id]['marker']);
        }
    }
    sensors = {};
}

// remove all crumbs from map
function clear_crumbs()
{
    for (var i=0; i<crumbs.length; i++)
    {
        map.removeLayer(crumbs[i]);
    }
    crumbs = [];
}

// empty textarea e.g. scratchpad
function clear_textarea(element_id)
{
    document.getElementById(element_id).value='';
}

// scroll BACK through socket messages sent to server and update scratchpad
function rt_prev_msg(element_id)
{
    // don't try and scroll backwards before start
    if (rt_history_cursor <= 1)
    {
        return;
    }

    rt_history_cursor--;

    document.getElementById(element_id).value = rt_send_history[rt_history_cursor-1];
}

// scroll FORWARDS through socket messages sent to server
function rt_next_msg(element_id)
{
    // don't scroll forwards after last msg
    if (rt_history_cursor >= rt_send_history.length)
    {
        return;
    }

    rt_history_cursor++;

    document.getElementById(element_id).value = rt_send_history[rt_history_cursor-1];
}

function marker_to_pos(marker)
{
    var lat_lng = marker.getLatLng();
    return '{  "lat": '+lat_lng.lat+', "lng": '+lat_lng.lng+' }';
}

// issue a request to server for the latest message
// Note this function DISABLED while RTMonitor doesn't send request_id in its reply
//function request_latest_msg()
//{
//    //sock_send_str('{ "msg_type": "rt_request", "request_id": "A", "options": [ "latest_msg" ] }');
//    var msg = {  options: [ 'latest_msg' ] };
//    RTMONITOR_API.request(CLIENT_DATA.rt_client_id,'A',msg,handle_records);
//}

// issue a request to server for the latest records
function request_latest_records()
{
    //sock_send_str('{ "msg_type": "rt_request", "request_id": "A", "options": [ "latest_records" ] }');
    var msg = {  options: [ 'latest_records' ] };
    rt_mon.request('A',msg,handle_records);
}

// issue a subscription to server for all records
function subscribe_all()
{
    rt_mon.subscribe('A',{},handle_records);
    //sock_send_str('{ "msg_type": "rt_subscribe", "request_id": "A" }');
}

// User has clicked on map.
// If 'poly_draw' is true then draw a polygon on the map and
// update the realtime scratchpad with a matching 'inside' request
function click_map(e)
{
    if (poly_draw)
    {
        add_poly_marker(e.latlng);
        if (poly_markers.length > 2)
        {
            poly_to_scratchpad();
        }
    }
}

function add_poly_marker(pos)
{
    var marker = L.circleMarker([pos.lat, pos.lng], { color: 'green', radius: 10 });
    poly_line.addLatLng(marker.getLatLng());
    poly_markers.push(marker);
    // if this is the first point of the polyline, highlight it
    if (poly_markers.length == 1)
    {
        marker.addTo(map);
        poly_start = marker;
    }
    // when we click the second point, we can remove the highlight of first point
    if (poly_markers.length == 2)
    {
        map.removeLayer(poly_start);
        poly_line_start = L.polyline([poly_markers[0].getLatLng(), poly_markers[1].getLatLng()],
                                     { color: 'green' }
                                    ).addTo(map);
    }

    if ( poly_markers.length > 2)
    {
        // add mid marker for most recent edge
        var prev_latlng = poly_markers[poly_markers.length-2].getLatLng();
        var lat_mid = (pos.lat + prev_latlng.lat) / 2;
        var lng_mid = (pos.lng + prev_latlng.lng) / 2;

        var mid_marker = L.circleMarker([lat_mid, lng_mid],
                                        { color: 'salmon',
                                          bubblingMouseEvents: false,
                                          radius: 10 });

        // when a mid-marker is clicked on, set that line as the finish line
        mid_marker.on('click', function (n)
                               { return function (e)
                                        { set_poly_line_finish(n);
                                        };
                               }(poly_mid_markers.length));

        mid_marker.addTo(map);

        poly_mid_markers.push(mid_marker);

        // add polygon closing line (and remove previous closing line)
        if (poly_line_close != null)
        {
            map.removeLayer(poly_line_close);
            map.removeLayer(poly_mid_marker_close);
        }
        prev_latlng = poly_markers[0].getLatLng();
        poly_line_close = L.polyline([], {dashArray: '10,5', color: 'blue'}).addTo(map);
        poly_line_close.addLatLng(pos);
        poly_line_close.addLatLng(prev_latlng);
        // add mid marker for closing edge
        lat_mid = (pos.lat + prev_latlng.lat) / 2;
        lng_mid = (pos.lng + prev_latlng.lng) / 2;

        poly_mid_marker_close = L.circleMarker([lat_mid, lng_mid],
                                               { color: 'salmon',
                                                 bubblingMouseEvents: false,
                                                 radius: 10 });
        // when a mid-marker is clicked on, set that line as the finish line
        poly_mid_marker_close.on('click', function (n)
                                          { return function (e)
                                                   { set_poly_line_finish(n);
                                                   };
                                          }(poly_mid_markers.length));

        poly_mid_marker_close.addTo(map);
    }
}

function poly_to_scratchpad()
{
    // update user scratchpad with filter text

    var rt_string = '';
    rt_string += '{ "msg_type": "rt_request",\n';
    rt_string += '  "request_id": "A",\n';
    rt_string += '  "options": [ "latest_records" ],\n';
    rt_string += '  "filters": [\n';
    rt_string += '     { "test": "inside",\n';
    rt_string += '       "lat_key": "Latitude",\n';
    rt_string += '       "lng_key": "Longitude",\n';
    rt_string += '       "points": [\n';
    for (var i=0; i<poly_markers.length; i++)
    {
        rt_string += marker_to_pos(poly_markers[i]);
        if (i < poly_markers.length - 1)
            rt_string += ',\n';
    }
    rt_string += '                 ]\n';
    rt_string += '             } ]\n';
    rt_string += '}';

    // write this msg to scratchpad
    document.getElementById('rt_scratchpad').value = rt_string;
}

// User has clicked on a mid-marker on the edge of a drawn polygon.
// This is assumed to select that edge as the 'finish' of a zone.
// The edge will be highlighted in red, and the 'poly_finish_index' set.
// Selecting the finish line will write the zone config to the scratchpad textarea.
function set_poly_line_finish(mid_index)
{
    poly_finish_index = mid_index + 1;

    if (poly_line_finish)
    {
        map.removeLayer(poly_line_finish);
    }

    // we're going to draw a line between the poly markers which is either
    // poly_finish_index .. poly_finish_index + 1, or
    // poly_finish_index .. marker[0].
    var next_index;
    if (poly_finish_index == poly_markers.length - 1)
    {
        next_index = 0;
    }
    else
    {
        next_index = poly_finish_index + 1;
    }
    // draw a red line on the map over the selected 'finish' edge
    poly_line_finish = L.polyline([ poly_markers[poly_finish_index].getLatLng(),
                                    poly_markers[next_index].getLatLng()],
                                  { color: 'red' }
                                 ).addTo(map);

    var map_center = map.getCenter();

    // here we construct the zone content of a tfc_server Zone config
    var z =  '{ "zone.center": {\n';
    z += '  "lat":'+map_center.lat+',\n';
    z += '  "lng":'+map_center.lng+'},\n';
    z += '"zone.zoom":'+map.getZoom()+',\n';
    z += '"zone.finish_index":'+poly_finish_index+',\n';
    z += '"zone.path":[\n';
    for (var i=0; i<poly_markers.length; i++)
    {
        z += marker_to_pos(poly_markers[i]);
        if (i < poly_markers.length - 1)
            z += ',\n';
    }
    z += '] }';
    // write this info to scratchpad
    document.getElementById('rt_scratchpad').value = z;
}

// Draw a polygon using JSON data from rt_scratchpad
function load_poly()
{
    var z_str = document.getElementById('rt_scratchpad').value;
    var z;
    try {
        z = JSON.parse(z_str);
    }
    catch(e) {
        alert('Could not parse scratchpad data');
        return;
    }

    if (z['zone.zoom'] && z['zone.center'])
    {
        var center = L.latLng(z['zone.center'].lat, z['zone.center'].lng);

        console.log('map.setView to ' + center + ',' + z['zone.zoom']);
        map.setView(center, z['zone.zoom']);
    }

    if (z['zone.finish_index'] && z['zone.path'] && z['zone.path'].length > 2)
    {
        // toggle poly_draw mode, clear existing poly if necessary
        draw_poly();
        if (!poly_draw)
        {
            draw_poly();
        }
        for (var i=0; i<z['zone.path'].length; i++)
        {
            var pos = L.latLng(z['zone.path'][i].lat, z['zone.path'][i].lng);
            console.log('adding pos '+pos);
            add_poly_marker(pos);
        }

        // highlight finish line
        set_poly_line_finish(z['zone.finish_index']-1);
    }
}

// Draw a polygon for the 'inside' filter test
function draw_poly()
{
    var el = document.getElementById('draw_poly');
    poly_draw = !poly_draw;
    el.value = poly_draw ? "Clear Polygon" : "Draw Polygon";
    if (poly_draw)
    {
        // poly_draw has just been set to TRUE,
        // so initialize poly_line
        poly_line = L.polyline([],
                               { color: 'blue',
                               }
                              ).addTo(map);
        // and change cursor to crosshair
        document.getElementById('map').style.cursor = 'crosshair';
    }
    else
    {
        // ploy_draw has just been set to false
        // so change crosshair cursor back to default
        document.getElementById('map').style.cursor = '';
        // and remove the drawn polygon
        if (poly_line != null)
        {
            map.removeLayer(poly_line);
        }

        if (poly_line_close != null)
        {
            map.removeLayer(poly_line_close);
        }

        if (poly_line_start != null)
        {
            map.removeLayer(poly_line_start);
        }

        if (poly_line_finish != null)
        {
            map.removeLayer(poly_line_finish);
        }

        for (var i=0; i<poly_markers.length; i++)
        {
            map.removeLayer(poly_markers[i]);
        }
        poly_markers = [];

        for (var i=0; i<poly_mid_markers.length; i++)
        {
            map.removeLayer(poly_mid_markers[i]);
        }
        poly_mid_markers = [];

        if (poly_mid_marker_close)
        {
            map.removeLayer(poly_mid_marker_close);
        }
    }
}

// user clicked on 'journey' in sensor popup
function click_journey(sensor_id)
{
    // get the route profile via the transport API, with draw=true
    get_route(sensors[sensor_id], true);
}

//user clicked on 'subscribe' for a bus
function subscribe_to_sensor(sensor_id)
{
    var msg_obj = { msg_type: 'rt_subscribe',
                    request_id: sensor_id,
                    filters: [ { test: "=", key: "VehicleRef", value: sensor_id } ]
                  };
    //sock_send_str(JSON.stringify(msg_obj));
    rt_mon.subscribe(sensor_id, msg_obj, handle_records);
}

// user clicked on 'more' in sensor popup
function click_more(sensor_id)
{
    var sensor = sensors[sensor_id];
    sensor.marker.setPopupContent(sensor_more_content(sensor_id));
}

// user clicked on 'less' in sensor popup
function click_less(sensor_id)
{
    var sensor = sensors[sensor_id];
    sensor.marker.setPopupContent(sensor_popup_content(sensor.msg));
}

// user has clicked the 'Reset' button
function page_reset()
{
    init();
}

// user has clicked to only show the map
function hide_control()
{
    map_only = true;
    document.getElementById('control_div').style.display = 'none';
    document.getElementById('progress_div').style.display = 'none';
    document.getElementById('map').style.width = '99%';
    document.getElementById('map').style.height = '99%';
    map.invalidateSize();
}

// User has 'escaped' from map_only mode
function page_normal()
{
    map_only = false;
    document.getElementById('control_div').style.display = '';
    document.getElementById('progress_div').style.display = '';
    document.getElementById('map').style.width = '61%';
    document.getElementById('map').style.height = '80%';
    map.invalidateSize();
}

// *************************************************************
// Recording buttons
// *************************************************************

function record_start()
{
    recording_on = true;
    document.getElementById('record_start').value = 'Recording';
}

function record_clear()
{
    recording_on = false;
    recorded_records = [];
    document.getElementById('record_start').value = 'Record';
}

function record_print()
{
    log('Printing '+recorded_records.length+' recorded records to console');
    var msgs = '[\n';
    for (var i=0; i<recorded_records.length; i++)
    {
        msgs += JSON.stringify(recorded_records[i]);
        if (i < recorded_records.length-1)
        {
            msgs += ',\n';
        }
        else
        {
            msgs += '\n]';
        }
    }
    console.log(msgs);
}

// ***********************
// Replay buttons

// User clicked 'Replay' button
// This launches an intervalTimer to step through the data records
function replay_start()
{
    // kill the real-time clock
    clearInterval(clock_timer);

    if (batch)
    {
        replay_batch();
        return;
    }

    // get start time from text box (js compatible)
    var start_time = new Date(document.getElementById('replay_start').value);
    if (!start_time)
    {
        log('<span style="color: red">'+
            'Bad replay start time format (try 2017-11-20T06:00:00Z)'+
            '</span>');
        return;
    }

    // if not paused, initialize the replay time to the chosen start time
    if (!replay_on)
    {
        replay_time = start_time;

        replay_index = 0;

        replay_errors = 0;

        // set 'replay mode' flag
        replay_on = true;

        log('Replay started '+replay_time);
    }
    // kick off regular timer
    replay_timer = setInterval(replay_timestep, replay_interval * 1000);
    log('Timer started '+replay_time);
}

// User has clicked the Replay Pause button
function click_replay_pause()
{
    clearInterval(replay_timer);
    log('Replay paused at '+replay_time);
}

// User has clicked the Replay Stop button
function replay_stop()
{
    clearInterval(replay_timer);
    // Reset 'replay mode' flag
    //replay_on = false;
    if (replay_time)
    {
        log('Replay stopped at '+replay_time);
    }
}

// User has clicked the Replay Step button, so increment to next data record
function replay_step()
{
    console.log('replay_step replay_index='+replay_index+', replay_on='+replay_on);

    clearInterval(replay_timer);
    // if not paused, initialize the replay time to the chosen start time
    if (!replay_on)
    {
        //replay_time = start_time;

        replay_index = 0;

        // set 'replay mode' flag
        replay_on = true;

        log('Step replay started ');//+replay_time);
    }
    replay_next_record();
}

// User has updated the Replay speedup value
function click_replay_speedup()
{
    replay_speedup = document.getElementById('replay_speedup').value;
    log('Changed replay speedup to '+replay_speedup);
}

// User has clicked on Show journey checkbox
function click_show_journey()
{
    var show_journey = document.getElementById("show_journey").checked;
    if (show_journey)
    {
        analyze = true;
        //draw_journey_profile(drawn_route_sensor_id);
    }
    else
    {
        analyze = false;
        hide_journeys();
    }
    // set analyze checkbox appropriately
    document.getElementById('analyze').checked = analyze;
}

// Load the test data
function load_test_sirivm_journey(test_name)
{
    console.log('load_test_sirivm_journey()',test_name);

    // kill the real-time clock in case it is running
    clearInterval(clock_timer);

    // kill the replay clock if it is running
    clearInterval(replay_timer);

    // Scrub all the sensor data
    sensors = {};

    // Load the relevant data records into the 'recorded_records' array for playback
    //debug we can replace this with a GET from the server, particularly when we have API
    var source_records = test_sirivm_journey[test_name];

    // transfer test records into 'recorded_records' store for replay
    recorded_records = [];
    for (var i=0; i<source_records.length; i++)
    {
        // *copy* test records into recorded_records
        recorded_records.push(Object.assign({},source_records[i]));
    }

    replay_index = 0;
    replay_errors = 0;
    replay_on = true;

    console.log('load_test_sirivm_journey()','Loaded test records '+test_name);
    log('load_test_sirivm_journey()','Loaded test records '+test_name);

    // turn analyze on
    analyze = true;
    document.getElementById('analyze').checked = true;

    // show the test journey
    //
    // Remove the current displayed routes
    hide_journeys();

    document.getElementById("show_journey").checked = true;

    // start replay
    replay_stop(); // stop replay if it is already running

    // replay only the first record
    //replay_next_record();
    var msg = recorded_records[0];
    replay_time = get_msg_date(msg);
    update_clock(replay_time);
    init_sensor(msg, replay_time);
    var sensor_id = msg[RECORD_INDEX];
    var sensor = sensors[sensor_id];
    var journey = cached_journey(sensor);
    if (journey)
    {
        console.log('Found cached journey for '+sensor_id);
        new_journey(sensor, journey);
        draw_journey_profile(sensor);
    }
    else
    {
        console.log('Test records '+test_name+' failed to find cached journey for '+sensor_id);
    }
}

// User has clicked on the 'hide map' checkbox.
// The map layer will be hidden, so only the stops and route are shown with the buses
function click_hide_map()
{
    var hide_map = document.getElementById("hide_map").checked;
    if (hide_map)
    {
        map.removeLayer(map_tiles);
    }
    else
    {
        map.addLayer(map_tiles);
    }
}

// User has toggled "Analyze" checkbox, so set global boolean
// This will control whether the bus->segment tracking code operates
function click_analyze()
{
    analyze = document.getElementById("analyze").checked;
}

// user has toggled 'batch' checkbox which controls whether replay
// clock is 'per second' or just steps through data record
function click_batch()
{
    batch = document.getElementById("batch").checked;
}

// User has clicked an annotate option
//
// The sensor data can be 'annotated' with the correct segments, which will be
// added to the data record as a property "segment_index": [x,y,x] where x,y,x are
// the selected values.
//
// The annotation can be "automatic" or "manual", the modes of which are mutually exclusive.
//
// "Automatic" annotation uses the segment probability algorithm to generate the 'correct'
// segment_index (e.g. 7) and add it to the data record (i.e. segment_index: [7] ).  This
// is a good way to create an initial set of values that can then be hand-corrected if needed.
//
// "Manual" annotation expects the user to click on the segment boxes in the progress visualization
// to insert the correct data.
function click_annotate_auto()
{
    annotate_auto = document.getElementById("annotate_auto").checked;
    if (annotate_auto)
    {
        log('On replay, data records will be annotated with segment_index');
        annotate_manual = false;
        document.getElementById("annotate_manual").checked = false;
    }
}

function click_annotate_manual()
{
    annotate_manual = document.getElementById("annotate_manual").checked;
    if (annotate_manual)
    {
        log('On replay, you can click the annotation boxes to update the segment_index annotations');
        annotate_auto = false;
        document.getElementById("annotate_auto").checked = false;
    }
}

// User has clicked 'Pause on error' checkbox which will cause the batch analysis to stop
// when the calculated segment_index does not match the annotation
function click_replay_stop_on_error()
{
    replay_stop_on_error = document.getElementById("replay_stop_on_error").checked;
}

