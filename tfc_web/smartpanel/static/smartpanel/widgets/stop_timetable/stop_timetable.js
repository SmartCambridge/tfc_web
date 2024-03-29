// /* Bus Stop Timetable Widget for ACP Lobby Screen */

/* jshint esversion:6 */
/* globals RTMONITOR_API, DEBUG, moment, Handlebars, get_box, is_inside */
/* exported StopTimetable */

/*

NOTES:

Being entirely event-driven, the flow of control in this widget is
complicated. Here's a summary of the primary flow.

The main data structure is journey_table which contains one row for each
journey today. The rows contain timetable and real time information
relating to these journeys.

self.init() is called from the framework to start everything off. This
establishes rtmonitor_connected() and rtmonitor_disconnected() as
callbacks for connect/disconnect events from RTMONITOR_API, initialises
the HTML in the container and calls populate_journeys().

populate_journeys() retrieves batches of journeys through this stop and
initialises journey_table. It makes recursively calls until all
remaining journeys have been retrieved. It then schedules itself to
run again early tomorrow morning to retrieve tomorrow's journeys. After
retrieving each batch of journeys, it calls refresh_display() and
refresh_subscriptions().

rtmonitor_disconnected() runs whenever the app is notified that the
web sockets interface has disconnected. It removes all records of any
subscriptions since they have just evaporated.

rtmonitor_connected() runs whenever the app is notified that the
web sockets interface has re-connected. It re-establishes necessary
subscriptions by calling refresh_subscriptions()

refresh_subscriptions() creates RTMONITOR_API subscriptions for any
journeys in the recent past or near future and removes subscriptions for
journeys outside these bounds. It nominates handle_message() to run each
time a new RT message comes in. Each time refresh_subscriptions() is run
it arranges to re-run itself in SUBSCRIPTION_REFRESH_INTERVAL seconds if
it's not rerun before then for other reasons.

handle_message() runs in response to incoming RT messages. It updates
the journey_table for the corresponding journeys and calls
refresh_display(),

refresh_display() re-draws the timetable display. Each time it run it
arranges to re-run itself in DISPLAY_REFRESH_INTERVAL seconds if it's
not rerun before then for other reasons.

*/

function StopTimetable(widget_id) {

    'use strict';

    //var DEBUG = ' stop_timetable_log';

    var self = this;

    self.widget_id = widget_id;

    // Symbolic constants

    var SECONDS = 1000,

    // Configuration constants

        // Maximum refresh interval for the display
        DISPLAY_REFRESH_INTERVAL      = 30 * SECONDS,
        // Maximum refresh interval for real-time subscriptions
        SUBSCRIPTION_REFRESH_INTERVAL = 60 * SECONDS,
        // Retry interval following failed API call
        API_RETRY_INTERVAL = 10 * SECONDS,
        // Maximum number of departures to add to the table
        MAX_LINES                     = 50,
        // Number of timetable journeys to retrieve in one batch
        JOURNEY_BATCH_SIZE            = 20,
        // The time zone of raw times in the timetable API
        TIMETABLE_TIMEZONE            = 'Europe/London',
        // The time zone needed for real time subscription requests
        REALTIME_TIMEZONE             = 'Europe/London',

        PARAMS_DEFAULT                = { title: 'Stop opp. Gates Bldg',
                                          stop: {   id: "0500CCITY424",
                                                    stop_id: "0500CCITY424",
                                                    atco_code: "0500CCITY424",
                                                    naptan_code: "CMBDGDMT",
                                                    common_name: "William Gates Building",
                                                    indicator: "opp",
                                                    locality_name: "Cambridge",
                                                    longitude: 0.09107756159,
                                                    latitude: 52.2112996707,
                                                    lng: 0.09107756159,
                                                    lat: 52.2112996707
                                                },
                                          offset: 0,
                                          layout: 'simple'
                                        },

   // Global state

        // DOM id of the <div> that contains departure information
        departure_div,
        // The ID of the timer that will eventually update the display
        display_timer_id,
        // The ID of the timer that will eventually refresh the subscriptions
        subscription_timer_id,
        // The ID of the timer that refreshes the displayed journey list
        journey_timer_id,
        // API retry timer
        api_retry_timer_id,
        // Flag, set when the widget is stopping
        closing = false,
        // Master table of today's journeys - top-level keys
        //     timetable: Raw TNDS timetable entry from API
        //       first: timetable object of first (origin) stop
        //       last: timetable object of last (destination) stop
        //       destinations: list of first matching timetable object
        //                     for each params.destinations
        //       last_is_destination: index into destinations[] of a
        //                     destination containing this journey's
        //                     last stop
        //       due: moment() of timetabled time at this stop
        //       eta: moment() of best estimate time at this stop
        //       [all of first/last/destinations[n] have additional
        //        .due = moment(this.time)]
        //     rt: most recent real time report for this journey
        //       rt_timestamp: moment() of last rt record receipt
        //       delay: moment.duration() of the most recent Delay
        //       vehicle: id of the vehicle doing the journey
        journey_table = [],
        // Index into journey_table by first.stop.atcocode + first.time
        journey_index = {}
    ;

    var rt_mon;

    // ==== Initialisation/startup functions ===========================

    this.display = function(config, params) {

        self.config = config;

        self.params = params;

        self.log('Running StopTimetable.display with', self.params);

        rt_mon = RTMONITOR_API.register(rtmonitor_connected, rtmonitor_disconnected);

        journey_table = [];

        journey_index = {};

        // clear all existing timers
        stop_timers();

        // Register handlers for connect/disconnect
        //RTMONITOR_API.ondisconnect(rtmonitor_disconnected);
        //RTMONITOR_API.onconnect(rtmonitor_connected);

        // On startup, calculate bounding boxes of any 'destination areas' given in params
        add_box_to_params_destinations_areas();

        // Set up the HTML skeleton of the container
        initialise_container(self.config.container_id);

        // Populate the journey table. As a side effect, this updates
        // the display, starts the refresh timer and subscribes to
        // real-time updates
        populate_journeys();

        rt_mon.connect();
    };


    // Widget 'close()' method
    // clean up outsanding timers and tell RTMonitor this widget is closed.
    this.close = function() {
        self.log('closing StopTimetable widget');
        closing = true;
        stop_timers();
        if (rt_mon) {
            rt_mon.close();
        }
    };


    // This widget *may* have been given params.destinations containing
    // broad destinations, each as a list of stops or a polygon (or both).
    // If a polygon, then params.destinations[i].area = [ {lat: lng:}, ... ].
    // This function adds a 'box' property {north: south: east: west; } containing
    // the bounding lat/longs of the polygon as an optimization for geo.js is_inside.
    function add_box_to_params_destinations_areas()
    {
        if (!self.params.destinations) {
            return;
        }

        for (var i=0; i<self.params.destinations.length; i++) {
            if (self.params.destinations[i].area) {
                self.params.destinations[i].box = get_box(self.params.destinations[i].area);
                // console.log('get_box '+JSON.stringify(params.destinations[i].box));
                //log('Destination', i);
                //log('           ', JSON.stringify(params.destinations[i].area));
                //log('           ', JSON.stringify(params.destinations[i].box));
            }
        }
    }

    function initialise_container(id) {

        var container = document.getElementById(id);

        // Empty the 'container' div (i.e. remove loading GIF)
        empty(container);

        var content_area = document.createElement('div');
        content_area.setAttribute('class', 'content_area');
        container.appendChild(content_area);

        var title = document.createElement('h1');
        var img = document.createElement('img');
        img.setAttribute('src', self.config.static_url + 'bus.png');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode(self.params.title));
        content_area.appendChild(title);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','widget_error');
        connection_div.setAttribute('id', id + '_connection');
        connection_div.appendChild(document.createTextNode('No connection - retrying'));
        container.appendChild(connection_div);

        departure_div = document.createElement('div');
        var spinner = document.createElement('img');
        spinner.setAttribute('src', self.config.static_url + 'indicator-lite.gif');
        spinner.setAttribute('class', 'spinner');
        departure_div.appendChild(spinner);
        content_area.appendChild(departure_div);
    }


    // ==== Timetable API functions ====================================

    function populate_journeys() {
        // Reset journey_table, populate it with today's journeys, and
        // schedule ourself to run again early tomorrow morning
        try {

            // This shouldn't happen
            // Cancel any outstanding subscriptions
            for (var i = 0; i < journey_table.length; i++) {
                var journey = journey_table[i];
                if (journey.rtsub) {
                    self.log('populate_journeys - un-subscribing', journey.rtsub);
                    rt_mon.unsubscribe(journey.rtsub);
                }
            }

            journey_table = [];
            journey_index = [];

            get_journey_batch(0);

        }
        finally {
            // Re-run popumate_journeys tomorrow morning, sometime
            // between 04:00:00 and 04:59:59.9999
            // NB: populate_journeys takes note of offset. Don't run it
            //     at a time when the maximum offset (currently +/- 120 min)
            //     could end up calculating the wrong day! So not earlier
            //     than 02:00 or later than 22:00
            var minutes = Math.random()*60;
            var tomorrow = moment().add(1, 'd').hour(4).minute(minutes);
            if (!closing) {
                console.log('[' + self.widget_id + ']', 'Scheduling next populate_journeys for', tomorrow.format());
                journey_timer_id = window.setInterval(function () {
                    if (moment().isAfter(tomorrow)) {
                        console.log('[' + self.widget_id + ']', 'Re-running populate_journeys');
                        clearInterval(journey_timer_id);
                        populate_journeys();
                    }
                }, 60 * SECONDS);
            }
        }

    }


    function get_journey_batch(iteration) {
        // Trigger retrieval of a batch of journey records

        self.log('get_journey_batch - iteration', iteration);
        // This shouldn't happen
        if (iteration > 100) {
            self.log('Excessive recursion in get_journey_batch');
            return;
        }

        // Start from 30 minutes ago if the table is empty,
        // or at the departure_time of the last entry
        var start_time;
        if (journey_table.length === 0) {
            start_time = get_now().tz(TIMETABLE_TIMEZONE)
                                 .subtract(30, 'm').format('HH:mm:ss');
        }
        else {
            var last_journey = journey_table[journey_table.length - 1];
            start_time = last_journey.timetable.time;
        }
        self.log('get_journey_batch - start_time:', start_time);

        var qs = '?stop_id='+encodeURIComponent(self.params.stop.stop_id);
        qs += '&datetime_from='+encodeURIComponent(start_time);
        qs += '&expand_journey=true';
        qs += '&nresults='+encodeURIComponent(JOURNEY_BATCH_SIZE);

        var uri = self.config.settings.SMARTPANEL_API_ENDPOINT + 'transport/journeys_by_time_and_stop/' + qs;
        self.log('get_journey_batch - fetching', uri);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.setRequestHeader('Authorization', 'Token ' + self.config.settings.SMARTPANEL_API_TOKEN);
        xhr.send();
        xhr.onreadystatechange = function() {
            if(!closing && (xhr.readyState === XMLHttpRequest.DONE)) {
                if (xhr.status !== 200) {
                    self.log('get_journey_batch - API error, status', xhr.status, xhr.responseText);
                    if (!closing) {
                        self.log('get_journey_batch - scheduling retry');
                        api_retry_timer_id = window.setTimeout(function () {
                            get_journey_batch(iteration);
                        }, API_RETRY_INTERVAL);
                    }
                }
                else {
                    self.log('get_journey_batch','API return status 200');
                    var api_result = JSON.parse(xhr.responseText);
                    var added = add_journeys(iteration,api_result);
                    // Run refresh_display() unconditionally so it
                    // can set up an empty display if there aren't any
                    // relevant buses
                    refresh_display();
                    // If we added at least one new record then update
                    // our subscriptions and recurse to get more
                    if (added) {
                        refresh_subscriptions();
                        get_journey_batch(++iteration);
                    }
                }
            }
        };

    }


    function add_journeys(iteration,data) {
        // Add new journeys to journey_table. Return the number of
        // records actually added

        self.log('add_journeys - got', data.results.length, 'results');

        var added = 0;

        for (var i = 0; i < data.results.length; i++) {
            var result = data.results[i];

            var first = result.journey.timetable[0];
            var last = result.journey.timetable[result.journey.timetable.length-1];
            first.due = timetable_time_to_moment(first.time);
            last.due = timetable_time_to_moment(last.time);

            var journey_key = first.stop.atco_code + '!' + first.time;

            // Have we seen it before?
            if (journey_index.hasOwnProperty(journey_key)) {
                self.log('add_journeys - skipping', journey_key, result.time);
                continue;
            }

            self.log('add_journeys - adding', journey_key, result.time);
            added++;

            // See if this journey goes to any of our destinations
            var r = make_destination_table(result);
            var destination_table = r[0];
            var last_is_destination = r[1];

            // Populate the journey_table
            var journey = {
                timetable: result,
                first: first,
                last: last,
                last_is_destination: last_is_destination,
                destinations: destination_table,
                due: timetable_time_to_moment(result.time),
                eta: timetable_time_to_moment(result.time),
                rt: {}
            };

            journey_index[journey_key] = journey;
            journey_table.push(journey);

        }

        self.log('add_journeys - actually added', added, 'journeys');

        return added;

    }

    // Helper function returns true if stops array contains stop (by stop_id / atco_code)
    // 'stops' will ALWAYS contain stops with stop_id
    // 'stop' may have only atco_code
    function contains_stop(stops, stop) {
        // convert test stop to a stop_id, use atco_code if no stop_id
        var stop_id = stop.stop_id ? stop.stop_id : stop.atco_code;
        for (var i=0; i<stops.length; i++ ) {
            if (stops[i].stop_id === stop_id) {
                return true;
            }
        }
        // We checked all the stops with no match, so return false
        return false;
    }

    function make_destination_table(result) {
        // Work out which, if any, destinations is served by this journey
        var destination_table = [];
        var last_is_destination;

        // For each supplied destination (if we have any)...
        if (self.params.destinations) {
            for (var d = 0; d < self.params.destinations.length; d++) {
                var destination = self.params.destinations[d];
                var seen_self = false;

                //log('Doing destination', d, destination.description);
                //log('                 ', destination.area);
                //log('                 ', destination.box);

                // ...for every timetable entry on this journey...
                for (var e = 0; e < result.journey.timetable.length; e++) {
                    var timetable_entry = result.journey.timetable[e];

                    //log('  trying', timetable_entry.stop.atco_code, timetable_entry.stop.common_name, seen_self);
                    //log('        ', timetable_entry.stop.latitude, timetable_entry.stop.longitude);


                    // ...does this journey go to this destination after
                    // passing ourself?
                    if (( seen_self ) &&
                        (( destination.stops &&
                           contains_stop(destination.stops, timetable_entry.stop) ) ||
                         ( destination.area &&
                           is_inside({ lat: timetable_entry.stop.latitude,
                                       lng: timetable_entry.stop.longitude },
                                     destination.area,
                                     destination.box)))) {
                        timetable_entry.due = timetable_time_to_moment(timetable_entry.time);
                        destination_table[d] = timetable_entry;
                        //log(' Matched');
                        break;
                    }

                    // Is this timetable entry 'us'?
                    if (timetable_entry.stop.atco_code === self.params.stop.stop_id) {
                        seen_self = true;
                    }

                }

                // Separately, is the last (final) stop of this journey
                // part of this destination?
                var last = result.journey.timetable[result.journey.timetable.length-1];
                if (( destination.stops &&
                      contains_stop(destination.stops, last.stop) ) ||
                    ( destination.area &&
                      is_inside({ lat: last.stop.latitude,
                                  lng: last.stop.longitude },
                                destination.area,
                                destination.box))) {
                        last_is_destination = d;
                }
            }
        }

        return [destination_table, last_is_destination];

    }

    // ==== Real-time subscription functions ===========================

    function rtmonitor_disconnected() {
        // this function is called by RTMonitorAPI if it DISCONNECTS from server
        self.log('stop_timetable rtmonitor_disconnected');
        document.getElementById(self.config.container_id+'_connection').style.display = 'inline-block';
        // Drop our record of the subscriptions that just evaporated
        for (var i = 0; i < journey_table.length; i++) {
            var journey = journey_table[i];
            journey.rtsub = undefined;
        }
    }


    function rtmonitor_connected() {
        // this function is called by RTMonitorAPI each time it has CONNECTED to server
        self.log('stop_timetable rtmonitor_connected');
        document.getElementById(self.config.container_id+'_connection').style.display = 'none';
        // Re-establish all the subscriptions that we need
        refresh_subscriptions();
    }


    function refresh_subscriptions() {
        // Walk journey_table, subscribe to real time updates for
        // journeys with due time within a window of (now + offset),
        // and un-subscribe for journeys outside these limits

        // !!! Beware that this MUTABLE !!!
        // !!! Don't call add()/subtract() on it without using clone()
        var now = get_now();

        self.log('refresh_subscriptions - running for', now.toISOString());

        // Cancel the update timer if it's running
        if (subscription_timer_id) {
            window.clearTimeout(subscription_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            // Define the sides of the subscription window
            var start = now.clone().subtract(30, 'minutes');
            var end = now.clone().add(60, 'minutes');

            for (var i = 0; i < journey_table.length; i++) {
                var journey = journey_table[i];

                if ( (journey.due.isAfter(start) && journey.due.isBefore(end)) ) {

                    if (!journey.rtsub) {
                        journey.rtsub = subscribe(journey.first.stop.atco_code, journey.first.due);
                    }

                }
                else {

                    if (journey.rtsub) {
                        self.log('refresh_subscriptions - unsubscribing', journey.rtsub);
                        rt_mon.unsubscribe(journey.rtsub);
                        journey.rtsub = undefined;
                    }

                }

            }
        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            if (!closing) {
                subscription_timer_id = window.setTimeout(refresh_subscriptions, SUBSCRIPTION_REFRESH_INTERVAL);
            }
        }

    }


    function subscribe(stop_id, time) {
        // call 'subscribe' for RT messages matching stop_id and (departure) time

        var timetable_time = time.clone().tz(TIMETABLE_TIMEZONE);
        var realtime_time = time.clone().tz(REALTIME_TIMEZONE);
        var request_id = stop_id+'_'+timetable_time.format('HH:mm:ss');
        self.log('subscribe','subscribing to', request_id);

        var request_obj = {
                options: [
                    'latest_records'
                    ],
                filters:
                    [
                        {
                            test: '=',
                            key: 'OriginRef',
                            value: stop_id
                        },
                        {
                            test: '=',
                            key: 'OriginAimedDepartureTime',
                            value: realtime_time.format('YYYY[-]MM[-]DDTHH[:]mm[:]ssZ')
                        }
                    ]
            };

        // Get most recent record for quick startup
        var request_status = rt_mon.request(request_id + '_latest', request_obj, handle_message);
        if (request_status.status !== 'rt_ok') {
            self.log('request failed ', JSON.stringify(request_status));
        }

        //var request_status = RTMONITOR_API.subscribe(self.widget_id, request_id, request_obj, handle_message);
        var subscribe_status = rt_mon.subscribe(request_id, request_obj, handle_message);

        if (subscribe_status.status !== 'rt_ok') {
            self.log('subscribe failed ', JSON.stringify(subscribe_status));
            return undefined;
        }

        return request_id;

    }


    function handle_message(incoming_data) {
        // Process incoming Web Socket messages

        self.log('handle_message');
        for (var i = 0; i < incoming_data.request_data.length; i++) {
            var msg = incoming_data.request_data[i];

            var origin = msg.OriginRef;
            var departure_time_str = moment(msg.OriginAimedDepartureTime).tz(TIMETABLE_TIMEZONE).format('HH:mm:ss');
            var key = origin + '!' + departure_time_str;

            if (journey_index.hasOwnProperty(key)) {
                var due = journey_index[key].due;
                var delay = moment.duration(msg.Delay);
                journey_index[key].rt = msg;
                journey_index[key].rt_timestamp = moment();
                journey_index[key].delay = delay;
                journey_index[key].eta = due.clone().add(delay);
                journey_index[key].vehicle = msg.VehicleRef;
            }
            else {
                /// This shouldn't happen
                self.log('handle_message', key, 'no match');
            }
        }

        // Refresh the display to allow for any changes
        refresh_display();

    }

    // ==== Display management =========================================

    function refresh_display() {
        // Update (actually recreate and replace) the display by
        // walking the journey_table

        self.log('refresh_display', self.params);

        // Cancel the update timer if it's running
        if (display_timer_id) {
            window.clearTimeout(display_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            var result;
            switch (self.params.layout) {
                case 'debug':
                    result = display_debug();
                    break;
                case 'multiline':
                    result = display_multiline();
                    break;
                case 'nextbus':
                    result = display_nextbus();
                    break;
                default:
                    if (self.params.layout !== 'simple') {
                        self.log('refresh_display - unexpected layout', self.params.layout, 'using \'simple\'');
                    }
                    result = display_simple();
            }

            empty(departure_div);
            var updated = document.createElement('div');
            updated.classList.add('timestamp');
            updated.appendChild(document.createTextNode('Updated ' + moment().format('HH:mm')));
            departure_div.appendChild(updated);
            if (result) {
                departure_div.appendChild(result);
            }

        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            if (!closing) {
                display_timer_id = window.setTimeout(refresh_display,DISPLAY_REFRESH_INTERVAL);
            }
        }
    }


    // *****************************************************************************************
    // ************* DISPLAY SIMPLE     ********************************************************
    // *****************************************************************************************
    function display_simple() {
        // Basic departure board layout

        //log('display_simple - running');

        var table = document.createElement('table');
        table.classList.add('timetable');
        table.classList.add('simple');
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Due'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Expected'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('Route'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('Destination'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        heading.appendChild(cell);

        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var journey = journey_table[i];

            // Skip anything that left in the past
            if (journey.eta.isBefore(get_now().subtract(1, 'minutes'))) {
                continue;
            }
            // Skip anything that terminates here
            if (journey.last.stop.atco_code === self.params.stop.stop_id) {
                continue;
            }

            nrows++;

            var last_stop = describe_stop(journey.last);

            var row = document.createElement('tr');
            // Flag the row for buses currently over 5 minutes late
            var thresh = journey.due.clone().add(5, 'm');
            if (fresh_timestamp(journey) && journey.eta.isAfter(thresh)) {
                 row.classList.add('issue');
            }

            cell = document.createElement('td');
            cell.classList.add('time');
            var span = document.createElement('span');
            span.classList.add('key');
            cell.appendChild(span);
            span.appendChild(document.createTextNode(journey.due.format('HH:mm')));
            row.appendChild(cell);

            // ETA, providing most recent RT record in the last minute
            cell = document.createElement('td');
            cell.classList.add('time');
            if (fresh_timestamp(journey)) {
                if (journey.delay.asMinutes() <= 1.0) {
                    cell.appendChild(document.createTextNode('On time'));
                }
                else {
                    cell.appendChild(document.createTextNode(journey.eta.format('HH:mm')));
                }
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            row.appendChild(cell);

            // Line name and final stop
            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(tidy_name(journey.timetable.journey_pattern.service.line.line_name)));
            row.appendChild(cell);

            cell = document.createElement('td');
            var text = tidy_name(last_stop);
            if (fresh_timestamp(journey)) {
                text += ' (at ' + journey.last.due.clone().add(journey.delay).format('HH:mm') +')';
            }
            else {
                text += ' (at ' + journey.last.due.format('HH:mm') +')';
            }
            cell.appendChild(document.createTextNode(text));
            row.appendChild(cell);

            var url;
            if (fresh_timestamp(journey)) {
                url = self.config.static_url + 'images/signal6.gif';
            }
            else {
                url = self.config.static_url + 'timetable-outline.png';
            }
            cell = document.createElement('td');
            cell.classList.add('icon');
            row.appendChild(cell);
            var img = document.createElement('img');
            cell.appendChild(img);
            img.setAttribute('src', url);
            img.setAttribute('alt', '');

            table.appendChild(row);

            // No point adding more than MAX_LINES rows because they will be
            // off the bottom of the display
            if (nrows >= MAX_LINES) {
                break;
            }

        }

        if (nrows === 0) {
            var div = document.createElement('div');
            div.setAttribute('class','no-departures');
            div.appendChild(document.createTextNode('No more departures today'));
            return div;
        }

        return table;

    }


    // *****************************************************************************************
    // ************ DISPLAY MULTILINE   ********************************************************
    // *****************************************************************************************
    function display_multiline() {
        // Multiline departure board layout

        self.log('display_multiline - running');

        var rows = display_multiline_view();

        // If there's nothing to display
        if (rows.length === 0) {
            var div = document.createElement('div');
            div.setAttribute('class','no-departures');
            div.appendChild(document.createTextNode('No more departures today'));
            return div;
        }

        return display_multiline_render(rows);

    }


    function display_multiline_view() {

        // First - build a view data structure

        var rows = [];
        for (var i=0; i<journey_table.length; i++) {
            var journey = journey_table[i];

            // No point adding more than MAX_LINES rows because they will be
            // off the bottom of the display
            if (rows.length >= MAX_LINES) {
                break;
            }
            // Skip anything that left in the past
            if (journey.eta.isBefore(get_now().subtract(1, 'minutes'))) {
                continue;
            }
            // Skip anything that terminates here
            if (journey.last.stop.atco_code === self.params.stop.stop_id) {
                continue;
            }

            var row = {};
            row.rows = 1;

            // Service code
            row.service_code = journey.timetable.journey_pattern.service.service_code;

            // Due
            row.due = journey.due.format('HH:mm');

            // Line
            row.line = tidy_name(journey.timetable.journey_pattern.service.line.line_name);

            // Final destination and time
            var last = journey.last;
            var last_desc = describe_stop(journey.last);
            // Is the last stop itself in a destination?
            if (journey.last_is_destination !== undefined) {
                last = journey.destinations[journey.last_is_destination];
                last_desc = self.params.destinations[journey.last_is_destination].description;
            }
            row.destination = {
                desc: tidy_name(last_desc),
                time: apply_delay(last.due, journey).format('HH:mm')
            };

            // Realtime data flag
            row.realtime = fresh_timestamp(journey);

            // Via
            row.via = [];
            if (self.params.destinations) {
                row.rows += 1;
                for (var d = 0; d < self.params.destinations.length; d++) {
                    if (journey.destinations[d] && d !== journey.last_is_destination) {
                        row.via.push({
                            desc: self.params.destinations[d].description,
                            time: apply_delay(journey.destinations[d].due, journey).format('HH:mm')
                        });
                    }
                }
            }

            // Delay
            row.delay = {};
            if (fresh_timestamp(journey)) {
                var minutes = journey.delay.minutes();
                var hours = journey.delay.hours();
                var eta = journey.eta.format('HH:mm');
                row.delay.mark = false;
                if (minutes < 1) {
                    row.delay.text = 'On time';
                    row.rows += 1;
                }
                else if (minutes < 60) {
                    row.delay.text = pluralise(minutes, 'minute') + ' late (' + eta +')';
                    row.delay.mark = true;
                    row.rows += 1;
                }
                else {
                    row.delay.text = pluralise(hours, 'hour') + ' ' + pluralise(minutes % 60, 'minute') +
                    ' late (' + eta +')';
                    row.delay.mark = true;
                    row.rows += 1;
                }
            }
            // This journey has no fresh real time data and the journey should have started
            else if (journey.first.due.isBefore()) {
                row.delay.text = 'Realtime data missing';
                row.delay.mark = true;
                row.rows += 1;
            }

            rows.push(row);

        }

        return rows;

    }


    function display_multiline_render(rows) {

        var table = document.createElement('table');
        table.classList.add('timetable');
        table.classList.add('multiline');

        var tr, td;

        // For each row in the result set
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var tbody = document.createElement('tbody');
            table.appendChild(tbody);

            // Build the top row
            tr = document.createElement('tr');
            tbody.appendChild(tr);

            td = document.createElement('td');
            tr.appendChild(td);
            td.classList.add('expected');
            td.setAttribute('rowspan', row.rows);
            var span = document.createElement('span');
            span.classList.add('key');
            td.appendChild(span);
            span.textContent = row.due;

            td = document.createElement('td');
            tr.appendChild(td);
            td.classList.add('line');
            td.setAttribute('rowspan', row.rows);
            // Add link to line page
            var a = document.createElement('a');
            td.appendChild(a);
            a.setAttribute('href', '/transport/service/' + row.service_code);
            a.setAttribute('target', '_blank');
            a.textContent = row.line;

            td = document.createElement('td');
            tr.appendChild(td);
            td.textContent = 'to';

            td = document.createElement('td');
            tr.appendChild(td);
            td.textContent = row.destination.desc + ' ';
            var span = document.createElement('span');
            td.appendChild(span);
            span.classList.add('together');
            span.textContent = '(' + row.destination.time +')';

            var url;
            if (row.realtime) {
                url = self.config.static_url + 'images/signal6.gif';
            }
            else {
                url = self.config.static_url + 'timetable-outline.png';
            }
            td = document.createElement('td');
            td.classList.add('icon');
            td.setAttribute('rowspan', row.rows);
            tr.appendChild(td);
            var img = document.createElement('img');
            td.appendChild(img);
            img.setAttribute('src', url);
            img.setAttribute('alt', '');

            // Build the 'via' row if needed
            if (row.via && row.via.length > 0) {
                tr = document.createElement('tr');
                tbody.appendChild(tr);
                tr.classList.add('via');

                td = document.createElement('td');
                tr.appendChild(td);
                td.textContent = 'via';

                td = document.createElement('td');
                tr.appendChild(td);

                var text = '';
                for (var v = 0; v < row.via.length; v++) {
                    var via = row.via[v];
                    if (v > 0) {
                        text = text + ', ';
                    }
                    text = text + via.desc + ' (' + via.time + ')';
                }
                td.textContent = text;
            }

            // Build the 'delay' row if needed
            if (row.delay.text) {
                tr = document.createElement('tr');
                tbody.appendChild(tr);
                tr.classList.add('timing');
                td = document.createElement('td');
                tr.appendChild(td);
                td.setAttribute('colspan', '3');
                if (row.delay.mark) {
                    td.classList.add('issue');
                }
                td.textContent = row.delay.text;
            }
        }

        return table;

    }


    // *****************************************************************************************
    // ************ DISPLAY DEBUG       ********************************************************
    // *****************************************************************************************

    function display_debug() {
        // Debug display board with internal data

        //log('display_debug - running');

        var table = document.createElement('table');
        table.classList.add('timetable');
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('OriginRef'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('DestRef'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Vehicle'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Dep.'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Due'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Seen'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Delay'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Expected'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('In'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('Route'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Arrives'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('To'));
        heading.appendChild(cell);

        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var journey = journey_table[i];

            // Skip anything that left in the past
            if (journey.eta.isBefore(get_now().subtract(1, 'minutes'))) {
                continue;
            }

            nrows++;

            var last_stop = describe_stop(journey.last);

            var row = document.createElement('tr');
            if (fresh_timestamp(journey)) {
                row.classList.add('seen');
            }
            else if (journey.first.due.isBefore(moment())) {
                row.classList.add('issue');
            }

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(journey.first.stop.atco_code));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(journey.last.stop.atco_code));
            cell.appendChild(document.createElement('br'));
            if (journey.vehicle) {
                cell.appendChild(document.createTextNode(journey.vehicle));
            }
            else{
                cell.appendChild(document.createTextNode('-'));
            }
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            cell.appendChild(document.createTextNode(journey.first.due.format('HH:mm')));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(journey.due.format('HH:mm')));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            if (journey.rt_timestamp) {
                //log(journey.rt.received_timestamp);
                cell.appendChild(document.createTextNode(journey.rt_timestamp.format('HH:mm')));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            cell.appendChild(document.createElement('br'));
            if (journey.delay) {
                cell.appendChild(document.createTextNode(journey.delay.toISOString()));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            if (fresh_timestamp(journey)) {
                cell.appendChild(document.createTextNode(journey.eta.format('HH:mm')));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(journey.eta.fromNow(true)));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(tidy_name(journey.timetable.journey_pattern.service.line.line_name)));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(journey.last.due.format('HH:mm')));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(tidy_name(last_stop)));
            row.appendChild(cell);

            table.appendChild(row);

            // No point adding more than MAX_LINES rows because they will be
            // off the bottom of the display
            if (nrows >= MAX_LINES) {
                break;
            }

        }

        if (nrows === 0) {
            var div = document.createElement('div');
            div.setAttribute('class','no-departures');
            div.appendChild(document.createTextNode('No more departures today'));
            return div;
        }

        return table;

    }


    // *****************************************************************************************
    // ************ DISPLAY NEXTBUS      *******************************************************
    // *****************************************************************************************
    function display_nextbus() {
        // Layout showing next bus to selected destinations

        self.log('display_nextbus - running');

        var result = document.createElement('div');
        result.classList.add('nextbus');

        // Standard table heading
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Due'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Expected'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Route'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Arrives'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        heading.appendChild(cell);

        // For each destination...
        for (var d = 0; d < self.params.destinations.length; d++) {
            var destination = self.params.destinations[d];
            var nrows = 0;

            var h3 = document.createElement('h3');
            h3.appendChild(document.createTextNode('To ' + destination.description));
            result.appendChild(h3);

            var table = document.createElement('table');
            table.classList.add('timetable');
            table.appendChild(heading.cloneNode(true));

            // ...for each journey...
            for (var j=0; j<journey_table.length; j++) {
                var journey = journey_table[j];

                // Skip anything that has already left
                if (journey.eta.isBefore(get_now())) {
                    continue;
                }

                // If this journey goes to this destination
                if (journey.destinations[d]) {
                    var row = document.createElement('tr');
                    var arrival = timetable_time_to_moment(journey.destinations[d].time);

                    // Due time
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    var span = document.createElement('span');
                    span.classList.add('key');
                    cell.appendChild(span);
                    span.appendChild(document.createTextNode(journey.due.format('HH:mm')));
                    row.appendChild(cell);

                    // ETA
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    if (fresh_timestamp(journey)) {
                        if (journey.delay.asMinutes() <= 1.0) {
                           cell.appendChild(document.createTextNode('On time'));
                        }
                        else {
                            cell.appendChild(document.createTextNode(journey.eta.format('HH:mm')));
                        }
                    }
                    else {
                        cell.appendChild(document.createTextNode(''));
                    }
                    row.appendChild(cell);

                    // Line name
                    cell = document.createElement('td');
                    cell.appendChild(document.createTextNode(tidy_name(journey.timetable.journey_pattern.service.line.line_name)));
                    row.appendChild(cell);

                    // Expected arrival
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    if (fresh_timestamp(journey)) {
                        cell.appendChild(document.createTextNode(arrival.clone().add(journey.delay).format('HH:mm')));
                    }
                    else {
                        cell.appendChild(document.createTextNode(arrival.format('HH:mm')));
                    }
                    row.appendChild(cell);

                    // Realtime indicator
                    var url;
                    if (fresh_timestamp(journey)) {
                        url = self.config.static_url + 'images/signal6.gif';
                    }
                    else {
                        url = self.config.static_url + 'timetable-outline.png';
                    }
                    cell = document.createElement('td');
                    cell.classList.add('icon');
                    row.appendChild(cell);
                    var img = document.createElement('img');
                    cell.appendChild(img);
                    img.setAttribute('src', url);
                    img.setAttribute('alt', '');

                    table.appendChild(row);
                    nrows++;
                    if (nrows >= 2) {
                        break;
                    }

                } // END journey goes to this destination

            } // END for each journey

            if (nrows === 0) {
                var div = document.createElement('div');
                div.setAttribute('class','no-departures');
                div.appendChild(document.createTextNode('No more departures today'));
                result.appendChild(div);
            }
            else {
                result.appendChild(table);
            }

        } // END for each destination

        return result;

    }

    // clear all outstanding timers
    function stop_timers() {
        self.log('stop_timers()');
        // Cancel the update timer if it's running
        if (display_timer_id) {
            self.log('clearTimeout(display_timer_id)');
            window.clearTimeout(display_timer_id);
        }
        if (subscription_timer_id) {
            window.clearTimeout(subscription_timer_id);
        }
        if (journey_timer_id) {
            window.clearInterval(journey_timer_id);
        }
        if (api_retry_timer_id) {
            window.clearInterval(api_retry_timer_id);
        }
    }


    //==== Utilities ===================================================


    this.log = function () {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_timetable_log') >= 0) {
            var args = [].slice.call(arguments);
            args.unshift('[' + self.widget_id + ']');
            console.log.apply(console, args);
        }
    }

    function empty(element) {
        // Delete the content of the DOM element `element`
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }


    function timetable_time_to_moment(time) {
        // Expand a UK localtime time into a full Date object based on today
        var result = moment().tz(TIMETABLE_TIMEZONE);
        result.hours(time.slice(0,2));
        result.minutes(time.slice(3,5));
        result.seconds(time.slice(6,8));
        result.milliseconds(0);
        return result;
    }


    function describe_stop(timetable_entry) {
        // Given a timetable entry, return a usable stop description

        var stop = timetable_entry.stop;
        var result = '';
        if (stop.locality_name.toLowerCase() !== 'cambridge') {
            result = stop.locality_name;
        }
        else {
            result = result + stop.common_name;
        }
        return result;
    }


    function fresh_timestamp(journey) {
        // is the latest RT information in journey fresh?
        return journey.rt_timestamp &&
                (journey.rt_timestamp.isAfter(moment().subtract(60, 's')));
    }


    function tidy_name(name) {
        // Fix assorted problems with bus and line names
        name = name.replace(/(\s+)Street$/i,'$1St');
        name = name.replace(/(\s+)Road$/i,'$1Rd');
        name = name.replace(/(\s+)Avenue$/i,'$1Ave');
        name = name.replace(/(\s+)Close$/i,'$1Cl');
        name = name.replace(/\|.*/, '');
        name = name.replace(/^Madingley Road Park & Ride/i, 'P&R');
        name = name.replace(/^Newmarket Road Park & Ride/i, 'P&R');
        name = name.replace(/^Trumpington Park & Ride/i, 'P&R');
        name = name.replace(/^Babraham Road Park & Ride/i, 'P&R');
        name = name.replace(/^Milton Park & Ride/i, 'P&R');
        name = name.replace(/Park[ -](and|&)[ -]Ride/i, 'P&R');
        name = name.replace(/Bus Station/i, 'Bus Stn');
        name = name.replace(/Cambridge North Railway Station/i, 'Cambridge Nth Stn');
        name = name.replace(/Hinchingbrooke/i, 'Hin\'brooke');
        name = name.replace(/Universal U/i, 'U');
        return name;
    }


    function get_now() {
        // Return the current time offset by params.offset or 0
        var offset = self.params.offset || 0;
        return moment().add(offset, 'minutes');
    }


    function pluralise(number,unit) {
        // Reurn number and unit with unit pluralised if necessary
        if (number === 1) {
            return number + ' ' + unit;
        }
        else {
            return number + ' ' + unit + 's';
        }
    }


    function apply_delay(time, journey) {
        // Apply journey's current delay to time if its big enough
        var new_time = time.clone();
        if (fresh_timestamp(journey) && journey.delay.asMinutes() > 1.0) {
            return new_time.add(journey.delay);
        }
        else {
            return new_time;
        }
    }


    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    //
    // For widget configuration, the layout_framework will call the widget:
    //   widget.configure(config, params)
    //   where:
    //
    //     config: will be an object including
    //         container_id: the DOM Id of the DIV toi use for the configuration form
    //         configuration_callback: a function (config,params) the widget will call
    //                                 on configuration save or cancel.
    //                                 On cancel, params will be null.
    //
    //     params: these are the *current* widget parameters to use as initial defaults on
    //             the config form input elements, so existing config can be editted.
    //
    // For 'production' configure you need to edit:
    //   this.configure(config, params)
    //   config_click_cancel(config)
    //   config_click_save(config, params)
    //
    // In this.configure(), by default a <table> is added to the config_div.
    // A helper function is provided:
    //   config_input( parent_element, (the DOM element to add input element to, typically a tbody)
    //                 property_type,  ( select | number | string ),
    //                 input_options,  (configuration parameters for the input field, such as text, title)
    //                 default_value   (typically the existing 'params' value if editting an existing widget)
    //               )
    //  config_input(..) will return an object:
    //    {
    //      value: function () -> the property value entered on the form
    //    }
    //

    // THIS IS THE METHOD CALLED BY THE WIDGET FRAMEWORK TO CONFIGURE THIS WIDGET
    this.configure = function (config, params) {

        var widget_config = new WidgetConfig(config);

        self.log('StopTimetable configuring widget with', config, params);

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
        config_title.innerHTML = 'Configure Bus Stop Display';
        config_div.appendChild(config_title);

        var config_form = document.createElement('form');

        config_div.appendChild(config_form);

        var input_result = input_stop_timetable(widget_config,
                                                config_form,
                                                (params && params.title) ? params : PARAMS_DEFAULT);

        return input_result;
    }

    // Input the StopTimetable parameters
    // input_stop_timetable: draw an input form (as a table) of the required inputs
    //   widget_config: an instantiated object from widget-config.js providing .input and .choose
    //   parent_el: the DOM element this input form will be added to
    //   params: the existing parameters of the widget
    function input_stop_timetable(widget_config, parent_el, params) {

        self.log('input_stop_timetable with',params);

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = "This widget displays information relevant to a BUS STOP.";
        config_info_text += " At its simplest (i.e. the 'Simple' layout) you choose a title and a stop and the widget will";
        config_info_text += " display a current timetable for that stop, updating with real-time information coming from the buses.";
        config_info1.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info1);

        var config_info3 = document.createElement('p');
        config_info_text = "Layout 'Multi-line' can provide a similar display to 'Simple', but in addition you can specify one";
        config_info_text += " or more intermediate destinations and the stop display will include arrival times for those (see";
        config_info_text += " 'destinations' below).";
        config_info3.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info3);

        var config_info4 = document.createElement('p');
        config_info_text = "Layout 'Nextbus' is similar to 'Multi-line', but is arranged 'per-destination' rather than a single";
        config_info_text += " list of departures (again, see 'destinations' below).";
        config_info4.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info4);

        var config_info5 = document.createElement('p');
        config_info_text = "'Destinations': intermediate places on a route (Layout Multi-line and Nextbus only).";
        config_info_text +=" You specify one either as a fixed set of bus stops";
        config_info_text += " OR as an area on the map.  E.g. if you create a destination called 'Train Station' and draw a box around";
        config_info_text += " the stops by Cambridge Railway Station, arrival times to there will be added for each relevant bus.";
        config_info_text += " (Hint - click the hexagon symbol on the top-right of the map to draw a box)";
        config_info5.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info5);

        var config_table = document.createElement('table');
        config_table.className = 'config_input_stop_timetable';

        var config_tbody = document.createElement('tbody');

        // Each config_input(...) will return a .value() callback function for the input data

        // TITLE
        //
        var title_result = widget_config.input( config_tbody,
                                         'string',
                                         { text: 'Main Title:',
                                           title: 'The main title at the top of the widget, e.g. bus stop name'
                                         },
                                         params.title);

        // STOP
        //
        self.log('configure() calling widget_config.input', 'stop', 'with',params.stop);
        var stop_result = widget_config.input( config_tbody,
                                           'bus_stop',
                                           { text: 'Stop:',
                                             title: "Click 'choose' to select stop from map",
                                           },
                                           params.stop);
        // offset input
        //
        self.log('configure() calling widget_config.input', 'offset', 'with',params.offset);
        var offset_result = widget_config.input( config_tbody,
                                          'number',
                                          { text: 'Timing offset (mins):',
                                            title: 'Set an offset (mins) if you want times for *later* buses than now',
                                            step: 'any'
                                          },
                                          params.offset);

        // Layout select
        //
        var layout_value = params.layout;

        self.log('configure() calling config_input', 'layout', 'with',params.layout);
        var layout_result = widget_config.input( config_tbody,
              'select',
              { text: 'Layout:',
                title: 'Choose your widget layout style from the dropdown',
                options: [ { value: 'simple', text: "Simple - Bus times at stop with final destination" },
                           { value: 'multiline', text: "Multi-line - include 'via' destinations" },
                           { value: 'nextbus', text: "Nextbus - Show buses to each 'via' destination area" }
                         ],
                onchange: input_layout_onchange
              },
              params.layout
            );

        // destinations input
        var destinations_result = null; // placeholder
        var destinations_element = null; // placeholder for the DOM element (row) that will contain the input
        var destinations_cache = null; // cache destinations so they are not lost completely when changing from
                                       // nextbus -> simple for example, and can be reloaded

        if (params.destinations) {
            destinations_cache = JSON.parse(JSON.stringify(params.destinations)); // copy list
            destinations_result = input_destination_list(widget_config, config_tbody, params.destinations);
            destinations_element = destinations_result.element;  // this is the DOM (row) element containing this input
        }

        config_table.appendChild(config_tbody);
        parent_el.appendChild(config_table);

        // local function to be called if user updates 'layout' input value
        // input_change is { value: <new value of property>,
        //                   parent: DOM object the contains select input row (i.e. typically a tbody)
        function input_layout_onchange(layout_el) {
            self.log('input_layout_onchange: layout changed from:',layout_value,'to:',layout_el.value);
            switch (layout_el.value) {
                case 'multiline':
                case 'nextbus':
                    if (!destinations_result) {
                        // add 'destinations' input list to the page if it isn't already there
                        destinations_result = input_destination_list(widget_config, config_tbody, params.destinations);
                        destinations_element = destinations_result.element;  // this is the DOM (row) element containing this input
                    }
                    break;

                case 'simple':
                case 'debug':
                    // if a 'layout' that doesn't require a destinations property is selected then
                    // remove the return object and the DOM object containing the input
                    destinations_result = null;
                    if (destinations_element) {
                        destinations_element.remove();
                    }
                    break;

                default:
                    self.log('config_layout_onchange: change to',layout_el.value,'ignored');
            }
        }

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // title
            config_params.title = title_result.value();
            // stop
            config_params.stop = stop_result.value();
            // offset
            var offset = offset_result.value();
            if (!isNaN(parseInt(offset)) && offset >= 0) {
                config_params.offset = parseInt(offset);
            }
            // layout
            config_params.layout = layout_result.value();

            // destinations
            if (destinations_result) {
                config_params.destinations = destinations_result.value();
            }

            self.log(self.widget_id,'input_stop_timetable returning params:',config_params);

            return config_params;
        }

        var config_fn = function () {
            return { title: title_result.value() };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    }// end input_stop-timetable()

    // Add a 'destinations' input to the main config table
    // parent_el is assumed to be a tbody, to which this fn appends a <tr>
    function input_destination_list(widget_config, parent_el, destinations) {
        self.log('input_destination_list called with', destinations);
        var row = document.createElement('tr');

        // create TD to hold 'name' prompt for field
        var td_name = document.createElement('td');
        td_name.className = 'widget_config_property_name';
        var label = document.createElement('label');
        //label.htmlFor = id;
        label.title = 'Enter your destinations each as a set of stops or an area on a map';
        label.appendChild(document.createTextNode('Destinations:'));
        td_name.appendChild(label);
        row.appendChild(td_name);

        // create TD to hold 'value' destination_list
        var td_value = document.createElement('td');
        td_value.className = 'widget_config_property_value';

        var destinations_table = document.createElement('table');
        destinations_table.className = 'config_destinations_table';
        destinations_table.style['border-collapse'] = 'separate';
        destinations_table.style['padding'] = '5px';

        var tbody = document.createElement('tbody');

        var destination_values = [];

        if (destinations) {
            for (var i=0; i<destinations.length; i++) {
                var destination = destinations[i];

                destination_values.push(input_destination(widget_config, tbody, destination));
            }
        } else {
            destination_values.push(input_destination(widget_config, tbody, null));
        }

        destinations_table.appendChild(tbody);
        td_value.appendChild(destinations_table);

        // create (+) add an element button
        var plus_url = self.config.static_url + 'images/plus.png';
        var plus_img = document.createElement('img');
        plus_img.setAttribute('src', plus_url);
        plus_img.setAttribute('alt', 'Add');
        plus_img.setAttribute('title', 'Add another destination');
        plus_img.className = 'widget_config_plus';
        // now set the onlclick callback for the (+) button to add another destination input element
        var plus_onclick = function () {
            self.log('plus_onclick called');
            destination_values.push(input_destination(widget_config, tbody,null));
        }
        plus_img.onclick = plus_onclick;

        td_value.appendChild(plus_img);

        row.appendChild(td_value);

        parent_el.appendChild(row);

        function value_fn () {
            var list_result = [];
            for (var i=0; i<destination_values.length; i++) {
                if (destination_values[i].value()) {
                    list_result.push(destination_values[i].value());
                }
            }

            return list_result;
        };

        return { value: value_fn,
                 valid: function () { return true; },
                 element: row
               };

    } // end input_destination_list

    // Add a 'destination' input (as a row in a 'destinations' table)
    function input_destination(widget_config, parent_el, destination) {
        self.log('input_destination called with',destination);

        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.className = 'widget_config_repeating_element';

        // create (x) delete this element button
        var x_url = self.config.static_url + 'images/x.png';
        var x_img = document.createElement('img');
        x_img.setAttribute('src', x_url);
        x_img.setAttribute('alt', 'Delete');
        x_img.setAttribute('title', 'Delete this destination');
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
        var tbody = document.createElement('tbody');

        var stops_result = widget_config.input( tbody,
                                                'bus_destination',
                                                { text: 'Title:',
                                                  title: 'Choose a simple name for this destination, e.g. City Centre'
                                                },
                                                destination );

        table.appendChild(tbody);
        td.appendChild(table);
        tr.appendChild(td);
        parent_el.appendChild(tr);

        function value() {
            if (removed) {
                return null;
            } else {
                return stops_result.value();
            }
        }

        return { value: value,
                 valid: function () { return true; }
               };
    }

    self.log('Instantiated StopTimetable');

}    // END of 'class' StopTimetable

/*

Example timetable API result:

{
    "results": [
        {
            "time": "00:15:00",
            "line": {
                "id": "20-8-A-y08-1",
                "line_name": "8|Citi",
                "description": "Cambridge - Impington - Histon - Cottenham",
                "standard_origin": "Emmanuel Street",
                "standard_destination": "Grays Lane",
                "operator": {
                    "id": "OId_SCCM",
                    "code": "SCCM",
                    "short_name": "Stagecoach in Cambridge",
                    "trading_name": "Stagecoach in Cambridge"
                }
            },
            "journey": {
                "id": "ea-20-8-A-y08-1-108-T0",
                "timetable": [
                    {
                        "order": 1,
                        "stop": {
                            "id": "0500CCITY487",
                            "atco_code": "0500CCITY487",
                            "naptan_code": "CMBGJPWM",
                            "common_name": "Emmanuel Street",
                            "indicator": "Stop E1",
                            "locality_name": "Cambridge",
                            "longitude": 0.12354433655,
                            "latitude": 52.204254599
                        },
                        "time": "00:15:00"
                    },
                    ...
                    {
                        "order": 36,
                        "stop": {
                            "id": "0500SCOTT025",
                            "atco_code": "0500SCOTT025",
                            "naptan_code": "CMBDWATD",
                            "common_name": "Telegraph Street",
                            "indicator": "opp",
                            "locality_name": "Cottenham",
                            "longitude": 0.12808762701,
                            "latitude": 52.2858098724
                        },
                        "time": "00:48:00"
                    }
                ],
                "departure_time": "00:15:00",
                "days_of_week": "Tuesday Wednesday Thursday Friday",
                "direction": "outbound",
                "route_description": "Emmanuel Street - Telegraph Street",
                "line": {
                    "id": "20-8-A-y08-1",
                    "line_name": "8|Citi",
                    "description": "Cambridge - Impington - Histon - Cottenham",
                    "standard_origin": "Emmanuel Street",
                    "standard_destination": "Grays Lane",
                    "operator": {
                        "id": "OId_SCCM",
                        "code": "SCCM",
                        "short_name": "Stagecoach in Cambridge",
                        "trading_name": "Stagecoach in Cambridge"
                    }
                }
            }
        }
    ]
}

Example real time monitoring record:

{
    "Bearing": "12",
    "DataFrameRef": "1",
    "DatedVehicleJourneyRef": "32",
    "Delay": "PT4M7S",
    "DestinationName": "Lavender Crescent",
    "DestinationRef": "0590PDD384",
    "DirectionRef": "INBOUND",
    "InPanic": "0",
    "Latitude": "52.5558243",
    "LineRef": "5",
    "Longitude": "-0.2270660",
    "Monitored": "true",
    "OperatorRef": "SCCM",
    "OriginAimedDepartureTime": "2018-01-22T08:30:00+00:00",
    "OriginName": "Western Spine Road",
    "OriginRef": "0590PSP940",
    "PublishedLineName": "5",
    "RecordedAtTime": "2018-01-22T08:40:07+00:00",
    "ValidUntilTime": "2018-01-22T08:40:07+00:00",
    "VehicleMonitoringRef": "SCCM-37222",
    "VehicleRef": "SCCM-37222",
    "acp_id": "SCCM-37222",
    "acp_lat": 52.5558243,
    "acp_lng": -0.227066,
    "acp_ts": 1516610407
},

*/
