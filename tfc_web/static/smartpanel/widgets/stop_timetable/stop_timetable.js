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

function StopTimetable(config, params) {

    'use strict';

    // Backwards compatibility or first argument
    var container;
    if (typeof(config) === 'string') {
        container = config;
    }
    else {
        this.config = config;
        container = config.container;
    }
    this.container = container;
    this.params = params;

    // Symbolic constants

    var SECONDS = 1000,

    // Configuration constants

        // Endpoint for the timetable API
        TIMETABLE_URI                 = 'http://tfc-app3.cl.cam.ac.uk/transport/api',
        // Maximum refresh interval for the display
        DISPLAY_REFRESH_INTERVAL      = 30 * SECONDS,
        // MAximum refresh interval for real-time subscriptions
        SUBSCRIPTION_REFRESH_INTERVAL = 60 * SECONDS,
        // Maximum number of departures to add to the table
        MAX_LINES                     = 50,
        // Number of timetable journeys to retrieve in one batch
        JOURNEY_BATCH_SIZE            = 20,
        // The time zone of raw times in the timetable API
        TIMETABLE_TIMEZONE            = 'Europe/London',
        // The time zone needed for real time subscription requests
        REALTIME_TIMEZONE             = 'Europe/London',

   // Global state

        // DOM id of the <div> that contains departure information
        departure_div,
        // The ID of the timer that will eventually update the display
        display_timer_id,
        // The ID of the timer that will eventually refresh the subscriptions
        subscription_timer_id,
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


    // ==== Initialisation/startup functions ===========================

    this.init = function() {

        log('Running StopTimetable.init', container);

        // Register handlers for connect/disconnect
        RTMONITOR_API.ondisconnect(rtmonitor_disconnected);
        RTMONITOR_API.onconnect(rtmonitor_connected);

        // On startup, calculate bounding boxes of any 'destination areas' given in params
        add_box_to_params_destinations_areas();

        // Set up the HTML skeleton of the container
        initialise_container(container);

        // Populate the journey table. As a side effect, this updates
        // the display, starts the refresh timer and subscribes to
        // real-time updates
        populate_journeys();

    };


    // This widget *may* have been given params.destinations containing
    // broad destinations, each as a list of stops or a polygon (or both).
    // If a polygon, then params.destinations[i].area = [ {lat: lng:}, ... ].
    // This function adds a 'box' property {north: south: east: west; } containing
    // the bounding lat/longs of the polygon as an optimization for geo.js is_inside.
    function add_box_to_params_destinations_areas()
    {
        if (!params.destinations) {
            return;
        }

        for (var i=0; i<params.destinations.length; i++) {
            if (params.destinations[i].area) {
                params.destinations[i].box = get_box(params.destinations[i].area);
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
        img.setAttribute('src', config.static_url + 'bus.png');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode(params.title));
        content_area.appendChild(title);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','widget_error');
        connection_div.setAttribute('id', id + '_connection');
        connection_div.appendChild(document.createTextNode('Connection issues'));
        container.appendChild(connection_div);

        departure_div = document.createElement('div');
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
                    log('populate_journeys - un-subscribing', journey.rtsub);
                    RTMONITOR_API.unsubscribe(journey.rtsub);
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
            console.log('[' + container + ']', 'Scheduling next populate_journeys for', tomorrow.format());
            var timer = window.setInterval(function () {
                if (moment().isAfter(tomorrow)) {
                    console.log('[' + container + ']', 'Re-running populate_journeys');
                    clearInterval(timer);
                    populate_journeys();
                }
            }, 60 * SECONDS);
        }

    }


    function get_journey_batch(iteration) {
        // Trigger retrieval of a batch of journey records

        log('get_journey_batch - iteration', iteration);
        // This shouldn't happen
        if (iteration > 100) {
            log('Excessive recursion in get_journey_batch');
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
        log('get_journey_batch - start_time:', start_time);

        var qs = '?stop_id='+encodeURIComponent(params.stop_id);
        qs += '&datetime_from='+encodeURIComponent(start_time);
        qs += '&expand_journey=true';
        qs += '&nresults='+encodeURIComponent(JOURNEY_BATCH_SIZE);

        var uri = TIMETABLE_URI + '/journeys_by_time_and_stop/' + qs;
        log('get_journey_batch - fetching', uri);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.send();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === XMLHttpRequest.DONE) {
                var api_result = JSON.parse(xhr.responseText);
                if (xhr.status !== 200) {
                    log('get_journey_batch - API error, status', xhr.status, api_result.details);
                }
                else {
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

        log('add_journeys - got', data.results.length, 'results');

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
                log('add_journeys - skipping', journey_key, result.time);
                continue;
            }

            log('add_journeys - adding', journey_key, result.time);
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

        log('add_journeys - actually added', added, 'journeys');

        return added;

    }


    function make_destination_table(result) {
        // Work out which, if any, destinations is served by this journey
        var destination_table = [];
        var last_is_destination;

        // For each supplied destination (if we have any)...
        if (params.destinations) {
            for (var d = 0; d < params.destinations.length; d++) {
                var destination = params.destinations[d];
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
                        (( destination.stop_ids &&
                           destination.stop_ids.indexOf(timetable_entry.stop.atco_code) !== -1 ) ||
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
                    if (timetable_entry.stop.atco_code === params.stop_id) {
                        seen_self = true;
                    }

                }

                // Separately, is the last (final) stop of this journey
                // part of this destination?
                var last = result.journey.timetable[result.journey.timetable.length-1];
                if (( destination.stop_ids &&
                      destination.stop_ids.indexOf(last.stop.atco_code) !== -1 ) ||
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
        log('stop_timetable rtmonitor_disconnected');
        document.getElementById(container+'_connection').style.display = 'inline-block';
        // Drop our record of the subscriptions that just evaporated
        for (var i = 0; i < journey_table.length; i++) {
            var journey = journey_table[i];
            journey.rtsub = undefined;
        }
    }


    function rtmonitor_connected() {
        // this function is called by RTMonitorAPI each time it has CONNECTED to server
        log('stop_timetable rtmonitor_connected');
        document.getElementById(container+'_connection').style.display = 'none';
        // Re-establish all the subscriptions that we need
        refresh_subscriptions();
    }


    function refresh_subscriptions() {
        // Walk journey_table, subscribe to real time updates for
        // journeys with due time within a window of (now + offset),
        // and un-subscribe for journeys outside these limits

        var now = get_now();

        log('refresh_subscriptions - running for', now.toISOString());

        // Cancel the update timer if it's running
        if (subscription_timer_id) {
            window.clearTimeout(subscription_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            for (var i = 0; i < journey_table.length; i++) {
                var journey = journey_table[i];

                if ( (journey.due.isBefore(now.subtract(30, 'minutes')) ||
                      journey.due.isAfter(now.add(60, 'minutes'))) ) {

                    if (journey.rtsub) {
                        log('refresh_subscriptions - unsubscribing', journey.rtsub);
                        RTMONITOR_API.unsubscribe(journey.rtsub);
                        journey.rtsub = undefined;
                    }

                }
                else {

                    if (!journey.rtsub) {
                        journey.rtsub = subscribe(journey.first.stop.atco_code, journey.first.due);
                    }

                }

            }
        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            subscription_timer_id = window.setTimeout(refresh_subscriptions, SUBSCRIPTION_REFRESH_INTERVAL);
        }
    }


    function subscribe(stop_id, time) {
        // call 'subscribe' for RT messages matching stop_id and (departure) time

        var timetable_time = time.clone().tz(TIMETABLE_TIMEZONE);
        var realtime_time = time.clone().tz(REALTIME_TIMEZONE);
        var request_id = stop_id+'_'+timetable_time.format('HH:mm:ss');
        log('subscribe - caller '+container+' subscribing to', request_id);

        var request_obj = {
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

        var request_status = RTMONITOR_API.subscribe(container, request_id, request_obj, handle_message);

        if (request_status.status !== 'rt_ok') {
            log('subscribe failed ', JSON.stringify(request_status));
            return undefined;
        }

        return request_id;

    }


    function handle_message(incoming_data) {
        // Process incoming Web Socket messages

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
                log('handle_records - message', key, 'no match');
            }
        }

        // Refresh the display to allow for any changes
        refresh_display();

    }

    // ==== Display management =========================================

    function refresh_display() {
        // Update (actually recreate and replace) the display by
        // walking the journey_table

        //log('refresh_display - running');

        // Cancel the update timer if it's running
        if (display_timer_id) {
            window.clearTimeout(display_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            var result;
            switch (params.layout) {
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
                    if (params.layout !== 'simple') {
                        log('refresh_display - unexpected layout', params.layout, 'using \'simple\'');
                    }
                    result = display_simple();
            }

            empty(departure_div);
            var updated = document.createElement('div');
            updated.classList.add('timestamp');
            updated.appendChild(document.createTextNode('Updated ' + moment().format('HH:mm')));
            departure_div.append(updated);
            if (result) {
                departure_div.appendChild(result);
            }

        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            display_timer_id = window.setTimeout(refresh_display,DISPLAY_REFRESH_INTERVAL);
        }
    }


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
            cell.classList.add('key');
            cell.appendChild(document.createTextNode(journey.due.format('HH:mm')));
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
            cell.appendChild(document.createTextNode(tidy_name(journey.timetable.line.line_name)));
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
                url = config.static_url + '/images/signal6.gif';
            }
            else {
                url = config.static_url + '/timetable-outline.png';
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


    function display_multiline() {
        // Multiline departure board layout

        log('display_multiline - running');

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

            var row = {};
            row.rows = 1;

            // Due
            row.due = journey.due.format('HH:mm');

            // Line
            row.line = tidy_name(journey.timetable.line.line_name);

            // Final destination and time
            var last = journey.last;
            var last_desc = describe_stop(journey.last);
            // Is the last stop itself in a destination?
            if (journey.last_is_destination !== undefined) {
                last = journey.destinations[journey.last_is_destination];
                last_desc = params.destinations[journey.last_is_destination].description;
            }
            row.destination = {
                desc: tidy_name(last_desc),
                time: apply_delay(last.due, journey).format('HH:mm')
            };

            // Realtime data flag
            row.realtime = fresh_timestamp(journey);

            // Via
            row.via = [];
            if (params.destinations) {
                row.rows += 1;
                for (var d = 0; d < params.destinations.length; d++) {
                    if (journey.destinations[d] && d !== journey.last_is_destination) {
                        row.via.push({
                            desc: params.destinations[d].description,
                            time: apply_delay(journey.destinations[d].due, journey).format('HH:mm')
                        });
                    }
                }
            }

            // Delay
            row.delay = {};
            if (fresh_timestamp(journey)) {
                var minutes = Math.trunc(journey.delay.asMinutes());
                var hours = Math.trunc(journey.delay.asHours());
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
            td.classList.add('key');
            td.setAttribute('rowspan', row.rows);
            td.textContent = row.due;

            td = document.createElement('td');
            tr.appendChild(td);
            td.classList.add('line');
            td.setAttribute('rowspan', row.rows);
            td.textContent = row.line;

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
                url = config.static_url + '/images/signal6.gif';
            }
            else {
                url = config.static_url + '/timetable-outline.png';
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
            cell.appendChild(document.createTextNode(tidy_name(journey.timetable.line.line_name)));
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


    function display_nextbus() {
        // Layout showing next bus to selected destinations

        log('display_nextbus - running');

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
        for (var d = 0; d < params.destinations.length; d++) {
            var destination = params.destinations[d];
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
                    cell.classList.add('key');
                    cell.appendChild(document.createTextNode(journey.due.format('HH:mm')));
                    row.append(cell);

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
                    cell.appendChild(document.createTextNode(tidy_name(journey.timetable.line.line_name)));
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
                        url = config.static_url + '/images/signal6.gif';
                    }
                    else {
                        url = config.static_url + '/timetable-outline.png';
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
                result.append(table);
            }

        } // END for each destination

        return result;

    }


    //==== Utilities ===================================================


    function log() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_timetable_log') >= 0) {
            var args = [].slice.call(arguments);
            args.unshift('[' + container + ']');
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
            //if (stop.indicator.toLowerCase() in RELATION_INDICATORS) {
            //    result = stop.indicator + ' ';
            //}
            result = result + stop.common_name;
            //if (!(stop.indicator.toLowerCase() in RELATION_INDICATORS)) {
            //    result = result + ' ' + stop.indicator;
            //}
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
        return name;
    }


    function get_now() {
        // Return the current time offset by params.offset or 0
        var offset = params.offset || 0;
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


    log('Instantiated StopTimetable', container, params);

    // END of 'class' StopTimetable

}

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
