
// ************************************************************************************
// ************************************************************************************
// ************************************************************************************
// ************************************************************************************
// *************  Bus tracking code ***************************************************
// ************************************************************************************
// ************************************************************************************

function BusTracker() {

    // ********************************************************************************************
    // ********************************************************************************************
    // ********************************************************************************************
    // ANALYSIS CONSTANTS
    //
    // Currently we have seperate weights for the 'initial' phase (when we first hear from the bus)
    // and the regular update phase.
    //
    // The weights are applied to the probability vectors provided by each analysis algorithm.
    //
    // We currently have 3 separate algorithms giving a probability vector for the likelihood the
    // bus is on each 'route segment' of its journey. I.e. [ 0.0, 0.1, 0.05, 0.4, 0.1, ...] would
    // suggest the bus is most likely on the fourth route segment, between the 3rd and 4th stops.
    //
    // 1. DISTANCE: uses the distance and angle of the current bus position relative to each
    //              segment to arrive at a probability the bus is currently on that segment.
    // 2. PROGRESS: uses the previous estimated position of the bus plus the time between the last
    //              position record and the current position record to estimate the new position.
    // 3. TIMETABLE: uses the timetable (i.e. the stop/time data in the journey) to estimate the
    //              probability the bus is currently on each segment

    // PATTERN_WEIGHTS, i.e. the probability vector weights to apply given a macro pattern
    //
    // Current the only dimension is 'pattern_starting' 0..1
    var PATTERN_WEIGHTS_INIT = 2;
    var PATTERN_WEIGHTS_STARTING = 5;
    var PATTERN_WEIGHTS = [
        // init = 0
        [
            { segment_distance_weight: 0.25, segment_progress_weight: 0.5, segment_timetable_weight: 0.25 },
            { segment_distance_weight: 0.25, segment_progress_weight: 0.5, segment_timetable_weight: 0.25 },
            { segment_distance_weight: 0.25, segment_progress_weight: 0.5, segment_timetable_weight: 0.25 },
            { segment_distance_weight: 0.25, segment_progress_weight: 0.5, segment_timetable_weight: 0.25 },
            { segment_distance_weight: 0.25, segment_progress_weight: 0.5, segment_timetable_weight: 0.25 }
        ],
        // init = 1
        [
            { segment_distance_weight: 0.4, segment_progress_weight: 0.0, segment_timetable_weight: 0.6 },
            { segment_distance_weight: 0.4, segment_progress_weight: 0.0, segment_timetable_weight: 0.6 },
            { segment_distance_weight: 0.4, segment_progress_weight: 0.0, segment_timetable_weight: 0.6 },
            { segment_distance_weight: 0.3, segment_progress_weight: 0.0, segment_timetable_weight: 0.7 },
            { segment_distance_weight: 0.3, segment_progress_weight: 0.0, segment_timetable_weight: 0.7 }
        ]];

    // Adjustments to the segment distance -> probability algorithm
    // If bus is in the 'passed' semicircle beyond the segment, the distance is adjusted times
    // this amount plus the segment distance adjust, i.e. segment probability will be lower.
    var SEGMENT_BEYOND_ADJUST = 0.5;
    // Similarly adjust the probability down if BEFORE the segment
    var SEGMENT_BEFORE_ADJUST = 0.5;
    // Bus distances from segments are adjusted upwards by this amount to stop very short distances like 2m dominating.
    var SEGMENT_DISTANCE_ADJUST = 50; // (m)

    // The progress probability algorithm assigns probabilties to a *distance* profile and
    // then maps that to segments. This would mean very short segments get very low probabilities.
    // We compensate for this by using a 'minimum' segment length (this can be thought of as each
    // stop being equivalent to half of this distance).
    var PROGRESS_MIN_SEGMENT_LENGTH = 150; // (m)

    // Constants defining SIRIVM message fields
    var RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    var RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    var RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                      // 'ISO8601' = iso-format string
    var RECORD_LAT = 'Latitude';      // name of property containing latitude
    var RECORD_LNG = 'Longitude';     // name of property containing longitude

    // ********************************************************************************************
    // **********  GLOBALS  ***********************************************************************
    // ********************************************************************************************

    var msg = null; // most recent bus position message

    var vehicle_id = null; // vehicle_id of bus

    var journey_profile = null; // enhanced version of the route, i.e. sequence of stop/times

    var segment_index; // current best guess of index of route segment bus is currently on

    // prediction algorithm weights
    var segment_distance_weight;

    var segment_progress_weight;

    var segment_timetable_weight;

    // probability vectors for bus on each route segment

    var segment_progress_vector = null; // probabilities based on progress from previous guess

    var segment_distance_vector = null; // probabilities based on distance and direction from each route segment

    var segment_timetable_vector = null; // probabilities based on timetable

    var segment_vector = null; // the 'overall' route segment probability vector

    // position of bus along current segment 0..1
    var segment_progress = null;

    // ********************************************************************************************
    // ********* BusTracker methods ***************************************************************
    //
    // .init(msg, clock_time) - initialize the tracker with a bus position message and current time
    //
    // .init_journey(journey) - update this BusTracker with a new journey
    //
    // .update(msg, clock_time)
    //
    // .get_segment_index()
    //
    // .get_journey_profile()
    //
    // .print_status() - dump the analysis parameters to console
    //
    // ********************************************************************************************

    // .init called when we have the first bus position message
    this.init = function (init_msg, clock_time) {

        //log('Initializing '+vehicle_id);

        segment_index = null; // index of current calculated journey segment for this bus (0 = before start)

        segment_progress = null; // progress of bus along current segment 0..1

        if (!init_msg['OriginRef'])
        {
            return;
        }

        msg = init_msg;

        vehicle_id = msg[RECORD_INDEX];

    }

    // Initial route analysis (e.g. when first position data record from bus)
    // called when we have the route from the transport API or JS cache
    this.init_journey = function (journey) {

        journey_profile = create_journey_profile(JSON.parse(JSON.stringify(journey))); // Copy journey into journey_profile

        console.log('rt_tracker init_route()', journey_profile);

        var segments = journey.length + 1;

        set_weights();

        segment_distance_vector = init_segment_distance_vector();

        segment_timetable_vector = init_segment_timetable_vector();

        // Combine vectors into overall SEGMENT PROBABILITY VECTOR (segment_vector)
        var segment_vector = [];

        for (var i=0; i < segments; i++)
        {
            segment_vector.push( segment_distance_weight * segment_distance_vector[i] +
                                 segment_timetable_weight * segment_timetable_vector[i]
                               );
        }

        // Set segment_index to segment with highest probability
        segment_index = max_index(segment_vector);

        console.log(hh_mm_ss(get_msg_date(msg))+
                    ' distance :'+vector_to_string(segment_distance_vector,' ','('));

        console.log('        timetable :'+vector_to_string(segment_timetable_vector,' ','('));

        // Note 'msg' has a .segment_index when it is 'annotated' with correct answer
        console.log('(INIT)   RESULT '+
                    (' '+segment_index).slice(-2)+
                    ':'+vector_to_string(segment_vector,'-','<','{',msg.segment_index));
        console.log('');

        // segment_progress is 0..1 along current segment (segment_index)
        segment_progress = get_segment_progress();

    }

    // *****************************************************************
    // Update segment_index and segment_vector
    //
    // This is the key function that calculates the position of the bus
    // along its route.
    //
    // The basic approach is to call sub-functions
    //  * update_segment_progress_vector(update_msg)
    //  * update_segment_distance_vector(update_msg)
    //  * update_segment_timetable_vector(update_msg)
    // each of which returns a
    // probability vector of the route segment probabilities, and then we
    // combine those to produce the final 'segment_vector'.
    //
    this.update = function (update_msg) {

        // If bus doesn't have a journey_profile then
        // there's nothing we can do, so return
        if (!journey_profile)
        {
            return;
        }

        var segments = journey_profile.length + 1; // number of segments is stops+1
                                                        // to include start/finish
        set_weights();

        // Get PROGRESS vector
        segment_progress_vector = update_segment_progress_vector(update_msg);

        // Get SEGMENT DISTANCE vector
        segment_distance_vector = update_segment_distance_vector(update_msg);

        // Get TIMETABLE vector
        segment_timetable_vector = update_segment_timetable_vector(update_msg);

        // Combine vectors into overall SEGMENT PROBABILITY VECTOR (segment_vector)
        segment_vector = [];

        for (var i=0; i < segments; i++)
        {
            segment_vector.push( segment_distance_weight * segment_distance_vector[i] +
                                 segment_progress_weight * segment_progress_vector[i] +
                                 segment_timetable_weight * segment_timetable_vector[i]
                               );
        }

        // Set segment_index to segment with highest probability
        segment_index = max_index(segment_vector);

        msg = update_msg;

        // segment_progress is 0..1 along current segment (segment_index)
        segment_progress = get_segment_progress();

        console.log(hh_mm_ss(get_msg_date(msg))+
                    ' progress :'+vector_to_string(segment_progress_vector,' ','('));

        console.log('         distance :'+vector_to_string(segment_distance_vector,' ','('));

        console.log('        timetable :'+vector_to_string(segment_timetable_vector,' ','('));

        console.log('         RESULT '+
                    (' '+segment_index).slice(-2)+
                    ':'+vector_to_string(segment_vector,'-','<','{',update_msg.segment_index));
        console.log('');

    }

    this.get_segment_index = function () {
        return segment_index;
    }

    this.get_journey_profile = function () {
        return journey_profile;
    }

    this.get_segment_progress = function () {
        return segment_progress;
    }

    // ******************************************************************************
    // ******************************************************************************
    // ********* Internal Functions  ************************************************
    // ******************************************************************************
    // ******************************************************************************

    // Return index of vector element containing highest value
    function max_index(vector) {
        var max_value = vector[0];
        var max_index = 0;

        for (var i=0; i<vector.length; i++)
        {
            if (vector[i] > max_value)
            {
                max_index = i;
                max_value = vector[i];
            }
        }

        return max_index;
    }

    // ******************************************************************************
    // ******************************************************************************
    // SET_WEIGHTS
    // Here we identify a macro 'pattern' and set the appropriate weights for the
    // probability vectors
    //
    function set_weights() {
        // convert starting 0..1 into an array index into PATTERN_WEIGHTS
        var starting_index = Math.round(pattern_starting() * (PATTERN_WEIGHTS_STARTING-1));

        var init_index = Math.round(pattern_init() * (PATTERN_WEIGHTS_INIT-1));

        var weights = PATTERN_WEIGHTS[init_index][starting_index];

        console.log('init['+init_index+'], starting['+starting_index+'] '+JSON.stringify(weights));

        segment_distance_weight = weights.segment_distance_weight;

        segment_progress_weight = weights.segment_progress_weight;

        segment_timetable_weight = weights.segment_timetable_weight;
    }

    // Return a value 0..1 according to whether this bus is in the 'starting route' phase
    // I.e. in the main, are we around the start time
    function pattern_starting() {
        //debug this needs fixing for routes that span midnight
        var STARTING_PERIOD = 600; // Treat first 10 mins from start time as 'starting period'

        var route_start_seconds = journey_profile[0].time_secs;
        var route_finish_seconds = journey_profile[journey_profile.length-1].time_secs;
        var seconds = get_msg_day_seconds(msg);

        if (seconds < route_start_seconds)
        {
            return 1.0;
        }
        if (seconds < route_start_seconds + STARTING_PERIOD)
        {
            return 0.8;
        }
        // If over a third of way into journey, pattern_starting = 0
        if (seconds > route_start_seconds + (route_finish_seconds - route_start_seconds)/3)
        {
            return 0.0;
        }
        //default
        return 0.4;
    }

    // Here is a stub for an 'init' pattern, returns 0..1
    // Basically 1 if there is no prior progress_vector, otherwise zero
    function pattern_init()
    {
        if (!segment_progress_vector)
        {
            return 1.0;
        }
        return 0.0;
    }

    // ******************************************************************************
    // ******************************************************************************
    // DISTANCE VECTOR ANALYSIS
    // Calculate segment probability vector based on DISTANCE FROM SEGMENTS
    // Route segment distance -> segment probability vector
    // ******************************************************************************
    // Return an array of distances of this bus from each route segment
    // where the segment is route[segment_index-1]..route[segment_index]

    // Calculate an INITIAL probability vector for segments given a bus
    function init_segment_distance_vector() {
        console.log('Segment distance INIT');
        return update_segment_distance_vector(msg);
    }

    // Calculate the segment probability vector for an existing bus
    function update_segment_distance_vector(update_msg) {
        // How many nearest segments to consider (zero out others)
        var NEAREST_COUNT = 5;

        var P = get_msg_point(update_msg);

        console.log('update_segment_distance_vector '+JSON.stringify(P)+' vs route length '+journey_profile.length);

        var segment_count = journey_profile.length + 1;

        // Create segment_distance_vector array of { segment_index:, distance: }
        var segment_distance_vector = [];

        // Add distance to first stop as segment_distance_vector[0]

        console.log('update_segment_distance_vector journey_profile[0]='+JSON.stringify(journey_profile[0]));

        segment_distance_vector.push( { segment_index: 0, distance: get_distance(P, stops_cache[journey_profile[0].stop_id]) } );

        // Now add the distances for route segments
        for (var seg_index=1; seg_index<segment_count-1; seg_index++)
        {
            //debug use journey_profile
            var prev_stop = stops_cache[journey_profile[seg_index-1].stop_id];
            var next_stop = stops_cache[journey_profile[seg_index].stop_id];
            var dist = get_distance_from_line(P, [prev_stop,next_stop]);

            segment_distance_vector.push({ segment_index: seg_index, distance: dist });
        }

        // And for the 'finished' segment[segment_count-1] add distance from last stop

        //debug use journey_profile
        // Add distance to last stop (for 'finished' segment)
        segment_distance_vector.push({ segment_index: segment_count - 1,
                               distance: get_distance(P, stops_cache[journey_profile[journey_profile.length-1].stop_id]) });

        // Create sorted nearest_segments array of NEAREST_COUNT
        // { segment_index:, distance: } elements
        var nearest_segments = segment_distance_vector
                                    .slice() // create copy
                                    .sort((a,b) => Math.floor(a.distance - b.distance))
                                    .slice(0,NEAREST_COUNT);

        //console.log('nearest : '+nearest_segments.map( x => JSON.stringify(x) ));

        // Create array[NEAREST_COUNT] containing segment probabilities 0..1, summing to 1
        //var nearest_probs = linear_adjust(
        //                        nearest_segments.map( x =>
        //                                              SEGMENT_DISTANCE_ADJUST /
        //                                              ( x.distance/2 + SEGMENT_DISTANCE_ADJUST)));
        var nearest_probs = segment_distances_to_probs(P, journey_profile, nearest_segments);

        // Initialize final result segment_vector with zeros
        // and then insert the weights of the nearest segments
        var segment_probability_vector = new Array(segment_count);

        // Initialize entire vector to 0
        for (var i=0; i<segment_count; i++)
        {
            segment_probability_vector[i] = 0;
        }
        // Insert in the calculations for nearest segments
        for (var j=0; j<nearest_segments.length; j++)
        {
            segment_probability_vector[nearest_segments[j].segment_index] = nearest_probs[j];
        }

        return segment_probability_vector;
    }

    // Convert Point, [ {segment_index, distance},... ] to probabilties in same order
    function segment_distances_to_probs(P, journey_profile, nearest_segments) {
        var probs = new Array(nearest_segments.length);

        // for development print the 'nearest segments' array to console
        //var debug_str = '';
        //for (var i=0; i<nearest_segments.length; i++)
        //{
        //    debug_str += JSON.stringify(nearest_segments[i]);
        //}
        //console.log(debug_str);

        for (var i=0; i<nearest_segments.length; i++)
        {
            var seg_index = nearest_segments[i].segment_index;

            var segment_distance = nearest_segments[i].distance;

            //var prob; // probability bus is on this segment
            probs[i] = segment_distance_to_prob(P, journey_profile, seg_index, segment_distance);
        }
        return linear_adjust(probs);
    }

    // Convert a segment_index + segment_distance to probability
    function segment_distance_to_prob(P, journey_profile, segment_index, segment_distance) {
        var prob;

        if (segment_index < journey_profile.length)
        {

            // First of all we'll see if the bus is BEYOND the end stop of the segment
            //
            // bearing_out is the bearing of the next route segment
            var bearing_out;

            if (segment_index < journey_profile.length - 1)
            {
                bearing_out = journey_profile[segment_index+1].bearing_in;
            }
            else
            {
                bearing_out = journey_profile[segment_index].bearing_in;
            }
            // bisector_out is the outer angle bisector of this segment and the next
            var bisector_out = journey_profile[segment_index].bisector;
            // turn_out is the degrees turned from this segment to the next (clockwise)
            var turn_out = journey_profile[segment_index].turn;
            // end_bearing_to_bus is the bearing of the bus from the end bus-stop
            var end_bearing_to_bus = Math.floor(get_bearing(journey_profile[segment_index], P));

            var beyond = test_beyond_segment(end_bearing_to_bus, turn_out, bearing_out, bisector_out);

            if (!beyond)
            {
                    // We believe the bus is probably NOT beyond the segment
                    //
                    // We can now test if it is BEFORE the start stop of the segment
                    //
                    if (segment_index == 0) // can't be before the 'not yet started' segment 0
                    {
                        prob = SEGMENT_DISTANCE_ADJUST /
                               ( segment_distance / 2 +
                                 SEGMENT_DISTANCE_ADJUST);
                    }
                    else
                    {
                        // route bearing on the run-up towards the segment start bus-stop
                        var bearing_before = journey_profile[segment_index-1].bearing_in;
                        // outer angle bisector bearing at the segment start bus-stop
                        var bisector_before = journey_profile[segment_index-1].bisector;
                        // turn at start bus-stop (degrees clockwise, i.e. turn left 10 degrees is 350)
                        var turn_before = journey_profile[segment_index-1].turn;
                        // bearing of bus from start bus-stop
                        var start_bearing_to_bus = Math.floor(get_bearing(journey_profile[segment_index-1],P));

                        var before = test_before_segment(start_bearing_to_bus,
                                                         turn_before,
                                                         bearing_before,
                                                         bisector_before);

                        if (!before)
                        {
                            // Here we are neither BEFORE or BEYOND, so use default probability
                            prob = SEGMENT_DISTANCE_ADJUST /
                                   ( segment_distance / 2 +
                                     SEGMENT_DISTANCE_ADJUST);
                        }
                        else
                        {
                            // We believe we are BEFORE the segment, so adjust the probability
                            prob = ( SEGMENT_DISTANCE_ADJUST /
                                     ( segment_distance / 2 +
                                       SEGMENT_DISTANCE_ADJUST)) * SEGMENT_BEFORE_ADJUST ;
                        }

                    }
            }
            else
            {
                    // We believe the bus is probably BEYOND the segment
                    prob = ( SEGMENT_DISTANCE_ADJUST /
                             ( segment_distance / 2 +
                               SEGMENT_DISTANCE_ADJUST)
                           ) * SEGMENT_BEYOND_ADJUST;
            }

            console.log( '{ segment '+segment_index+
                         ',dist='+Math.floor(segment_distance)+
                         ',out='+bearing_out+'°'+
                         ',turn='+turn_out+'°'+
                         ',bus='+end_bearing_to_bus+'°'+
                         ',bi='+bisector_out+'°'+
                         ','+(before ? 'BEFORE' : 'NOT BEFORE')+
                         ','+(beyond ? 'BEYOND' : 'NOT BEYOND')+
                         ',prob='+(Math.floor(100*prob)/100)+
                         '}'
                         );
        }
        else // on 'finished' segment
        {
            prob = SEGMENT_DISTANCE_ADJUST /
                   ( segment_distance / 2 +
                         SEGMENT_DISTANCE_ADJUST);
        }
        return prob;
    }

    // return TRUE is bus is BEYOND segment
    function test_beyond_segment(bearing_to_bus, turn, bearing_out, bisector) {
        var beyond; // boolean true if bus is BEYOND segment

        // For a small turn, we use the perpendicular line to next segment either
        // side of current stop as boundary of considering this stop passed
        if (turn < 45 || turn > 315)
        {
            var angle1 = angle360(bearing_out-90);
            var angle2 = angle360(bearing_out+90);
            if (test_bearing_between(bearing_to_bus, angle1, angle2))
            {
                // We believe the bus is probably BEYOND the stop
                beyond = true;
                //console.log(' BEYOND <45 turn='+turn);
            }
            else
            {
                // We believe the bus is probably NOT BEYOND the stop
                beyond = false;
                //console.log(' NOT BEYOND <45 turn='+turn);
            }
        }
        else // For a larger turn we use the zone from bisector to bearing_out
        {
            if (turn < 180)
            {
                beyond = test_bearing_between(bearing_to_bus, bisector, bearing_out);
            }
            else
            {
                beyond = test_bearing_between(bearing_to_bus, bearing_out, bisector);
            }

            //console.log( (beyond ? ' BEYOND ' : ' NOT BEYOND ')+ ' >45 turn='+turn);
        }
        return beyond;
    }

    // return TRUE if bus is BEFORE segment
    function test_before_segment(bearing_to_bus, turn, bearing_before, bisector) {
        var before; // boolean true if bus is BEFORE segment

        //console.log('test_before_segment bus:'+bearing_to_bus+
        //            ', turn: '+turn+
        //            ', bearing_before: '+bearing_before+
        //            ', bisector: '+bisector);
        // For a small turn, we use the perpendicular line to next segment either
        // side of current stop as boundary of considering this stop passed
        if (turn < 45 || turn > 315)
        {
            var angle1 = angle360(bearing_before+90);
            var angle2 = angle360(bearing_before-90);
            if (test_bearing_between(bearing_to_bus, angle1, angle2))
            {
                // We believe the bus is probably BEFORE the stop
                before = true;
                //console.log(' BEFORE <45 turn='+turn);
            }
            else
            {
                // We believe the bus is probably NOT BEFORE the stop
                before = false;
                //console.log(' NOT BEFORE <45 turn='+turn);
            }
        }
        else // For a larger turn we use a region between bisectors:
        {
            // For a larger turn we treat as 'before' the area between the outer bisector
            // and midway between the inner bisector and the bearing_before.
            var inner_boundary = angle360(bearing_before+180);

            if (turn < 135 || turn > 225) // i.e. turn is >45 and <135
            {
                inner_boundary = get_angle_bisector(inner_boundary, bisector);
            }
            //var bearing_back = get_angle_bisector(bisector, bearing_before);

            if (turn < 180) // turn left
            {
                // note test_bearing_between always checks CLOCKWISE
                before = test_bearing_between(bearing_to_bus, inner_boundary, bisector);
            }
            else // turn right
            {
                before = test_bearing_between(bearing_to_bus, bisector, inner_boundary);
            }

            //console.log('BEFORE '+before+
            //        ', turn: '+turn+
            //        ', inner_boundary: '+Math.floor(inner_boundary)+
            //        ', bisector: '+Math.floor(bisector)+
            //        ', bearing_to_bus: '+Math.floor(bearing_to_bus));

            //console.log( (before ? ' BEFORE ' : ' NOT BEFORE ')+ ' >45 turn='+turn);
        }
        return before;
    }

    // ******************************************************************************
    // ******************************************************************************
    // ******************************************************************************
    // SEGMENT PROGRESS VECTOR ANALYSIS
    // Calculate segment probability vector based on PROGRESS along route
    // Projects bus position forwards using predicted speed and time between records
    // ******************************************************************************

    function update_segment_progress_vector(update_msg) {
        var SEGMENT_PROGRESS_ERROR = 0.1; // Default value where segments not within progress

        var SEGMENT_MIN_HOP_DISTANCE = 50; // (m) If bus has hopped less than this, then use hop_distance
                                   // as progress_delta

        var SEGMENT_MIN_LENGTH = 150; // (m), if route segment seems shorter then this, then use this.

        var SEGMENT_PROGRESS_MAX = 1.3; // Multiplier of 'progress_delta' to assign as possible segments

        var MIN_HOP_DISTANCE = 50; // (m) If bus has hopped less than this, then use hop_distance
                                   // as progress_delta

        var MIN_SEGMENT_DISTANCE = 150; // (m), if route segment seems shorter then this, then use this.

        var segments = journey_profile.length + 1;

        //debug maybe only do this in segment_timetable_vector
        // Exit early with segment=0 if time < route start
        var msg_date = get_msg_date(update_msg);
        if ((msg_date.getSeconds() + 60 * msg_date.getMinutes() + 3600 * msg_date.getHours()) <
            journey_profile[0].time_secs)
        {
            console.log('Segment progress PRE-START');
            var start_vector = new Array(segments);
            start_vector[0] = 0.9;
            start_vector[1] = 0.1;
            for (var i=2; i<segments; i++)
            {
                start_vector[i] = 0;
            }
            return start_vector;
        }
        // hop_time (s) is time delta since last data point
        var hop_time = msg ? (get_msg_date(msg).getTime() -
                                          get_msg_date(msg)
                                         ) / 1000 :
                                         0;
        hop_time = Math.floor(hop_time);

        // hop_distance (m) is how far bus has moved since last data point
        var hop_distance = msg ? get_distance(get_msg_point(msg), get_msg_point(update_msg)) : 0;
        hop_distance = Math.floor(hop_distance);

        // Here's how far the bus is along its route
        var segment_start_distance = segment_index > 0 ? journey_profile[segment_index-1].distance : 0;

        var segment_end_distance = journey_profile[segment_index].distance;

        var progress_distance = segment_start_distance +
                                segment_progress *
                                ( segment_end_distance - segment_start_distance);
        progress_distance = Math.floor(progress_distance);

        console.log(hh_mm_ss(get_msg_date(update_msg))+
                    ' segment_index: '+segment_index+
                    ' ('+(Math.floor(segment_progress*100)/100)+
                    ' of '+segment_start_distance+'..'+segment_end_distance+')'+
                    ' progress_distance: '+progress_distance+
                    ' hop_time: '+hop_time+
                    ' hop_distance: '+hop_distance);

        // *** *** ***
        // Estimate PROGRESS DELTA (the distance along route the bus has moved since last data record)

        var progress_delta = Math.floor(hop_distance); // The route distance we are predicting
                                                       // (we will update this below)

        var hop_max_progress = SEGMENT_PROGRESS_MAX;

        var bus_speed = progress_speed(segment_index, journey_profile);

        // If bus appears to have moved very little, we will use hop distance as the estimated progress_delta
        if (hop_distance < SEGMENT_MIN_HOP_DISTANCE)
        {
            console.log('          SHORT HOP, (using hop distance) progress_delta: '+progress_delta);
        }
        else
        {
            // Estimate progress distance based on speed and time since last point
            // with upward adjustment to (hop_distance+5%) if that is larger. I.e.
            // progress_delta must be AT LEAST hop_distance (this occurs when bus is
            // unusually fast, typically on straight road so adjustment makes sense).
            progress_delta = Math.max(bus_speed * hop_time, hop_distance * 1.05);
            // print some development info
            if (progress_delta > bus_speed * hop_time)
            {
                console.log('         FAST HOP, using hop_distance+5% as progress_delta');
                hop_max_progress = 1.1;
            }
            // remove decimals for easy printing
            progress_delta = Math.floor(progress_delta);
        }

        // ****************************
        // Now we have:
        // progress_distance: distance along route BEFORE we got this latest data record.
        // progress_delta: estimate for how further along the route we have progressed in hop_time
        //
        // ****************************

        // Initialize final result segment_vector with default small values
        // and then insert the weights of the segments within range
        var vector = new Array(segments);

        // create 'background' error values
        for (var i=0; i<segments; i++)
        {
            vector[i] = SEGMENT_PROGRESS_ERROR;
        }

        // Update all the segment probabilities with range of progress_delta

        var update_segment = Math.max(segment_index,1); // The index of the current segment we are considering

        if (segment_index == 0)
        {
            vector[0] = 1;
        }

        while (update_segment < segments &&
               journey_profile[update_segment-1].distance < progress_distance + progress_delta * hop_max_progress)
        {
            vector[update_segment++] = 1;
        }

        // Print some development info to js console
        console.log('         bus_speed: '+(Math.floor(bus_speed*100)/100)+
                        ', progress_delta: '+progress_delta+
                        ', hop_max_progress: '+hop_max_progress+
                        ', estimated progress distance: '+(progress_distance+progress_delta)+
                        ', reached segment index '+(update_segment-1));

        return linear_adjust(vector);
    }


    // ******************************************************************************
    // PATH PROGRESS VECTOR ANALYSIS
    // Calculate segment probability vector based on PROGRESS along path
    // Projects bus position forwards using predicted speed and time between records
    // ******************************************************************************

    function update_path_progress_vector(update_msg) {
        // CONSTANTS used in the algorithm
        var PROGRESS_ERROR = 0.1; // General error to apply to all segments
                                  // in case algorithm is completely wrong
                                  // i.e. background probability is PROGRESS_ERROR/segments

        // How far we will look ahead to calculate distance probabilities
        // relative to progress_delta (i.e. estimated progress distance)
        var PROGRESS_MAX = 2;

        var MIN_HOP_DISTANCE = 50; // (m) If bus has hopped less than this, then use hop_distance
                                   // as progress_delta

        var MIN_SEGMENT_DISTANCE = 150; // (m), if route segment seems shorter then this, then use this.

        var PROGRESS_STEPS = 10; // We will model the progress probability distribution in 10 steps

        var PROGRESS_STOPPED_TIME = 15; // How long we assume bus is stopped at each stop (s)

        // Note for 'n' stops we have 'n+1' segments, including before start and after finish
        var segments = journey_profile.length + 1;

        //debug maybe only do this in segment_timetable_vector
        // Exit early with segment=0 if time < route start
        var msg_date = get_msg_date(update_msg);
        if ((msg_date.getSeconds() + 60 * msg_date.getMinutes() + 3600 * msg_date.getHours()) <
            journey_profile[0].time_secs)
        {
            var start_vector = new Array(segments);
            start_vector[0] = 0.9;
            start_vector[1] = 0.1;
            for (var i=2; i<segments; i++)
            {
                start_vector[i] = 0;
            }
            return start_vector;
        }

        // hop_time (s) is time delta since last data point
        var hop_time = msg ? (get_msg_date(update_msg).getTime() - get_msg_date(msg) ) / 1000 : 0;
        hop_time = Math.floor(hop_time);

        // hop_distance (m) is how far bus has moved since last data point
        var hop_distance = msg ? get_distance(get_msg_point(msg), get_msg_point(update_msg)) : 0;
        hop_distance = Math.floor(hop_distance);

        // Here's how far the bus is along its route
        var segment_start_distance = segment_index > 0 ? journey_profile[segment_index-1].distance : 0;

        var segment_end_distance = journey_profile[segment_index].distance;

        var progress_distance = segment_start_distance +
                                segment_progress *
                                ( segment_end_distance - segment_start_distance);
        progress_distance = Math.floor(progress_distance);

        console.log(hh_mm_ss(get_msg_date(update_msg))+
                    ' segment_index: '+segment_index+
                    ' progress_distance: '+progress_distance+
                    ' hop_time: '+hop_time+
                    ' hop_distance: '+hop_distance);

        // *** *** ***
        // Estimate PROGRESS DELTA (the distance along route we estimate the bus has moved since last data record)

        var progress_delta = Math.floor(hop_distance); // The distance we are predicting the bus has moved along route
                                                       // (we will update this below)

        // 'spread' is the estimated standard deviation of the probability curve
        var spread = hop_time / 2; // 3.08

        var hop_max_progress = PROGRESS_MAX;

        var hop_stopped_time = PROGRESS_STOPPED_TIME;

        // If bus appears to have moved very little, we will use hop distance as the estimated progress_delta
        if (hop_distance < MIN_HOP_DISTANCE)
        {
            console.log('          SHORT HOP, (below min hop distance) progress_delta: '+progress_delta);
        }
        else
        {
            var bus_speed = progress_speed(segment_index, journey_profile);

            // Estimate progress distance based on speed and time since last point
            // with upward adjustment to (hop_distance+5%) if that is larger. I.e.
            // progress_delta must be AT LEAST hop_distance (this occurs when bus is
            // unusually fast, typically on straight road so adjustment makes sense).
            progress_delta = Math.max(bus_speed * hop_time, hop_distance * 1.05);
            // print some development info
            if (progress_delta > bus_speed * hop_time)
            {
                console.log('         FAST HOP, using hop_distance+5% as progress_delta');
                hop_max_progress = 1.1;
                hop_stopped_time = 0;
            }
            // remove decimals for easy printing
            progress_delta = Math.floor(progress_delta);
            console.log('         bus_speed: '+(Math.floor(bus_speed*100)/100)+
                        ', progress_delta: '+progress_delta
                       );
        }

        // ****************************
        // Now we have:
        // progress_distance: distance along route BEFORE we got this latest data record.
        // progress_delta: estimate for how further along the route we have progressed in hop_time
        //
        // ****************************

        // *** *** ***
        // Build a probability curve in 'step_time' time increments, with the
        // maximum probability at the route distance we think most likely, i.e. cast forward
        // the bus_speed for the latest hop_time i.e. (previous) progress_distance plus
        // (current) progress_delta.
        // We're using a Gaussian curve (with a high standard deviation) to model probability.
        // we will put some proportionate values into array, which ultimately will be normalized
        var factors = new Array();

        // arbitrarily modelling distance and time in 10 steps
        var step_distance = progress_delta / PROGRESS_STEPS;

        var step_time = hop_time / PROGRESS_STEPS;

        // Steps forwards 'hop_max_progress' times the hop_time
        for (var i=0; i<PROGRESS_STEPS * hop_max_progress; i++)
        {
            // let's try a gaussian distribution around progress_delta (which we will skew below)
            var progress_time = i * step_time;

            var factor = 1 / Math.pow(Math.E, Math.pow( hop_time - progress_time, 2) / (2 * spread * spread));

            factors.push({time: progress_time, prob: factor});
        }

        // Print some development info to js console
        console.log('          Estimated progress distance: '+(progress_distance+progress_delta));
        var str = '';
        for (var i=0; i<factors.length; i++)
        {
            str += '{ time: '+Math.floor(factors[i].time*10)/10+
                   ', prob: '+Math.floor(factors[i].prob*100)/100+'}';
        }
        console.log(str);

        // Ok, so now we have factors as array of {dist: x, prob: y} pairs
        // *** *** ***

        // *** *** ***
        // Next step is to apply those factors to the 'vector' array

        // Initialize final result segment_vector with default small values
        // and then insert the weights of the segments within range
        var vector = new Array(segments);

        // create 'background' error values
        for (var i=0; i<segments; i++)
        {
            vector[i] = PROGRESS_ERROR / segments;
        }

        var update_segment = Math.max(segment_index,1); // The index of the current segment we are considering
        var update_factor = 0; // The index of the current factor we are considering
        var factor_start = progress_distance; // The distance (since start of route) at which we are considering current factor

        // Here is the main part of this analysis.
        // The 'factors' calculated earlier are now apportioned to the relevant segments

        // We step forwards through BOTH the factors and the segments
        // and apportion the factors where the factors and segments overlap.
        while (update_factor < factors.length && update_segment < segments - 1)
        {
            // segment_start and segment_end are the route distance boundaries of current segment
            var segment_start = journey_profile[update_segment-1].distance;
            var segment_end = journey_profile[update_segment].distance;

            // factor_start and factor_end are the boundaries of the current probability factor
            var factor_end = factor_start + step_distance;

            //console.log('trying update factor '+update_factor+
            //            ' ('+factor_start+'..'+factor_end+') '+
            //            ' on segment '+update_segment+
            //            ' ('+segment_start+'..'+segment_end+')'
            //            );

            // Here we calculate the boundaries of the overlap between the segment and factor
            var overlap_start = Math.max(factor_start, segment_start);
            var overlap_end = Math.min(factor_end, segment_end);

            // factor_overlap_ratio is the proportion of the current factor assignable to the segment
            var factor_overlap_ratio = (overlap_end - overlap_start) / step_distance;

            if (factor_overlap_ratio > 0)
            {
                vector[update_segment] += factors[update_factor].prob *
                                                factor_overlap_ratio;
                console.log('MOVING segment '+update_segment+', factor '+update_factor+
                            ', factor_overlap_ratio is '+(Math.floor(factor_overlap_ratio*100)/100)+
                            ' added '+(Math.floor(factors[update_factor].prob * factor_overlap_ratio*100)/100)+
                            ', TOTAL = '+(Math.floor(vector[update_segment]*100)/100));
            }

            // Check if we have arrived at a bus stop, if so add additional factors based on TIME at stop (hop_stopped_time)
            // Note we ALWAYS increase either update_factor or update_segment, so loop is sure to terminate
            var factor_stopped_ratio; // the proportion of the current factor that has been applied as 'stopped' time
            if (factor_end > segment_end)
            {
                var factor_remaining_time = step_time * (1 - factor_overlap_ratio);
                var stop_remaining_time = hop_stopped_time; // remaining time (s) bus must be stopped during this update loop
                while (update_factor < factors.length && stop_remaining_time > 0)
                {
                    var factor_stopped_time = Math.min(factor_remaining_time, stop_remaining_time);
                    var factor_stopped_ratio = factor_stopped_time / step_time;
                    stop_remaining_time -= factor_stopped_time;
                    vector[update_segment] += factors[update_factor].prob * factor_stopped_ratio;
                    console.log('STOPPED segment '+update_segment+', factor '+update_factor+
                                ', factor_stopped_ratio is '+(Math.floor(factor_stopped_ratio*100)/100)+
                                ' added '+(Math.floor(factors[update_factor].prob * factor_stopped_ratio * 100)/100)+
                                ' TOTAL = '+(Math.floor(vector[update_segment]*100)/100));
                    if (stop_remaining_time > 0)
                    {
                        update_factor++;
                        factor_remaining_time = step_time;
                    }
                    // adjust factor_start (distance) so factor stopped ratio is converted to distance
                    factor_start = journey_profile[update_segment].distance - step_distance * factor_stopped_ratio;
                }
                // We have accumulated the stop time, so now can move on to next segment (with partial current factor remaining)
                update_segment++;
            }
            else
            {
                update_factor++;
                factor_start += step_distance;
            }
        }

        // Linear adjust so max is 1 and sum is 1
        var segment_probability_vector = linear_adjust(vector);

        //console.log('            prog2 :'+segment_probability_vector,' ','(');

        return segment_probability_vector;
    }

    // Return estimated forward speed (m/s) for bus on segment segment_index given a journey_profile.
    // We use the length of the nearby route segments to estimate probable speed, i.e. a section
    // of the route with short segments will give a lower speed than if the segments were long.
    function progress_speed(segment_index, journey_profile) {
        var MIN_EST_SPEED = 6.1; // (m/s) Minimum speed to use for estimated bus speed
        var MAX_EST_SPEED = 15;  // (m/s)

        // Estimate bus_speed
        // Calculate the local averate route segment distance, used for the speed estimate
        var avg_segment_distance;

        if (segment_index == 0)
        {
            avg_segment_distance = 100;
        }
        else if (segment_index <= journey_profile.length - 3)
        {
            avg_segment_distance = (journey_profile[segment_index+2].distance -
                                    journey_profile[segment_index-1].distance
                                   ) / 3;
        }
        else if (segment_index <= journey_profile.length - 2)
        {
            avg_segment_distance = (journey_profile[segment_index+1].distance -
                                    journey_profile[segment_index-1].distance
                                   ) / 2;
        }
        else
        {
            avg_segment_distance = journey_profile[segment_index].distance -
                                   journey_profile[segment_index-1].distance;
        }

        avg_segment_distance = Math.floor(avg_segment_distance);

        // Estimate bus speed (m/s)
        return Math.min(MAX_EST_SPEED,
                        Math.max(MIN_EST_SPEED,
                                 (avg_segment_distance - 240)/294 + MIN_EST_SPEED));
    }

    // ******************************************************************************
    // Calculate segment probability vector based on TIMETABLE
    // ******************************************************************************

    function init_segment_timetable_vector() {
        console.log('Timetable vector INIT');
        return update_segment_timetable_vector(msg);
    }

    function update_segment_timetable_vector(update_msg) {
        var TIMETABLE_ERROR = 0.08; // General background value for likelihood

        var TIME_AHEAD_SECONDS = 120; // How far ahead of schedule do we think the bus can be

        var TIME_BEHIND_SECONDS = 600; // How far behind schedule can the bus be

        var segments = journey_profile.length + 1;

        // get JS date() of data record
        var msg_date = get_msg_date(update_msg);

        // convert to time-of-day in seconds since midnight (as in journey_profile)
        var msg_secs = msg_date.getSeconds() + 60 * msg_date.getMinutes() + 3600 * msg_date.getHours();

        var before_start = msg_secs < journey_profile[0].time_secs;

        var vector = new Array(segments);

        var error = before_start ? TIMETABLE_ERROR / 5 : TIMETABLE_ERROR; // our likelihood of error is low before start

        var seg_index = 0; // seg_index zero is 'before start'

        var segment_start_time = -24*60*60; // we don't have a 'start time' for segment zero,
                                            // so use negative number
        var segment_finish_time;

        //console.log('before_start='+before_start+' msg_secs='+msg_secs);

        while (seg_index < segments)
        {
            //console.log('segment_start_time='+segment_start_time);

            if (seg_index == segments - 1) // if finished route
            {
                if (msg_secs > segment_start_time)
                {
                    vector[seg_index] = 1;
                    //console.log('bus finished');
                }
                else
                {
                    vector[seg_index] = error;
                    //console.log('bus not finished'); //debug we need margin of error here
                }
            }
            else
            {
                segment_finish_time = journey_profile[seg_index].time_secs;
                //console.log('segment_finish_time='+segment_finish_time);
                if ((msg_secs > segment_start_time - TIME_AHEAD_SECONDS) &&
                    (msg_secs < segment_finish_time + TIME_BEHIND_SECONDS))
                {
                    vector[seg_index] = 1;
                }
                else
                {
                    vector[seg_index] = error;
                }
                segment_start_time = segment_finish_time;
            }
            //console.log('vector['+seg_index+']='+vector[seg_index])
            seg_index++;
        }
        return linear_adjust(vector);
    }

    // ******************************************************************************
    // ******************************************************************************
    // ******************************************************************************
    // ******************************************************************************


    // Return progress 0..1 along a route segment for a bus.
    // The current route for this bus is in journey_profile
    // and the current segment is between stops route[segment_index-1]..route[segment_index]
    function get_segment_progress() {
        if ((segment_index == 0) || (segment_index == journey_profile.length))
        {
            return 0;
        }

        var pos = get_msg_point(msg);

        var prev_stop = stops_cache[journey_profile[segment_index - 1].stop_id];

        var next_stop = stops_cache[journey_profile[segment_index].stop_id];

        var distance_to_prev_stop = get_distance(pos, prev_stop);

        var distance_to_next_stop = get_distance(pos, next_stop);

        return distance_to_prev_stop / (distance_to_prev_stop + distance_to_next_stop);
    }

    // ***************************************************************************************************
    // Return array {time: (seconds), distance: (meters), turn: (degrees) } for route,
    // starting at {starttime,0,0}
    // where route is array of:
    //   {vehicle_journey_id:'20-4-_-y08-1-98-T2',order:1,time:'06:02:00',stop_id:'0500SCAMB011'},...
    // and returned journey_profile is SAME SIZE array:
    //    {"time_secs":21840, // timetabled time-of-day in seconds since midnight at this stop
    //     "lat": 52.123,     // latitiude of stop
    //     "lng": -0.1234,    // longitude of stop
    //     "bearing_in": 138, // bearing of vector approaching this stop (== bearing of current segment)
    //     "bisector": 68,    // bearing at mid-point of OUTER angle of turn
    //     "distance":178,    // length (m) of route segment approaching this stop
    //     "turn":39},...     // angle of turn in route from this stop to next (0..360) clockwise
    function create_journey_profile(journey) {

        var journey_profile = [];

        // iterate along journey, creating a time/distance/turn value for each stop
        for (var i=0; i<journey.length; i++)
        {
            var stop_id = journey[i].stop_id ? journey[i].stop_id : journey[i].stop['atco_code'];

            //debug skip stops not in cache
            // i(this will be an error when we have stop data included in timetable API)
            if (stops_cache_miss(stop_id))
            {
                load_stop(journey[i].stop);
                //console.log('stops cache miss for '+journey[i].stop_id);
                //continue;
            }

            var route_element = {};

            route_element.time_secs = get_seconds(journey[i].time);

            route_element.stop_id = stop_id;

            route_element.time = journey[i].time;

            route_element.lat = stops_cache[stop_id].lat;
            route_element.lng = stops_cache[stop_id].lng;

            // note we are using this journey_profile (not journey) for the previous stop
            // in case we are ignoring stops not in stops_cache
            if (journey_profile.length == 0)
            {
                // add first element for start stop at time=timetabled, distance=zero
                route_element.distance = 0;
            }
            else
            {
                var prev_stop = stops_cache[journey_profile[journey_profile.length-1].stop_id];

                var this_stop = stops_cache[stop_id];

                route_element.distance =
                    Math.floor( journey_profile[journey_profile.length-1].distance +
                                get_distance(prev_stop, this_stop));

                route_element.bearing_in = Math.floor(get_bearing(prev_stop, this_stop));
            }

            journey_profile.push(route_element);
        }

        if (journey_profile.length < 2)
        {
            console.log('create_journey_profile: '+vehicle_id+' stops_cache total miss?');
            return null;
        }

        // Now provide correct values at journey_profile[0]
        journey_profile[0].bearing_in = journey_profile[1].bearing_in;
        journey_profile[0].bisector = angle360(journey_profile[0].bearing_in+90);

        // Add .turn and .bisector to each element of journey_profile
        for (var i=1; i < journey_profile.length; i++)
        {
            if (i==journey_profile.length-1)
            {
                journey_profile[i].turn = 0;
                journey_profile[i].bisector = angle360(journey_profile[i].bearing_in + 90);
            }
            else
            {
                var prev_stop = stops_cache[journey_profile[i-1].stop_id];
                var this_stop = stops_cache[journey_profile[i].stop_id];
                var next_stop = stops_cache[journey_profile[i+1].stop_id];
                var bearing_out = get_bearing(this_stop, next_stop);
                journey_profile[i].turn = Math.floor(angle360(bearing_out - journey_profile[i].bearing_in));
                journey_profile[i].bisector = Math.floor(get_bisector(prev_stop, this_stop, next_stop));
            }
        }

        // debug print journey profile to console
        //for (var i=0; i<journey_profile.length; i++)
        //{
        //    console.log(i+' '+JSON.stringify(journey_profile[i]));
        //}
        console.log('create_journey_profile: '+vehicle_id+' '+
                    journey_profile[0].stop_id+' @ '+journey_profile[0].time+' to '+
                    journey_profile[journey_profile.length-1].stop_id+' @ '+
                    journey_profile[journey_profile.length-1].time+
                    (journey.length == journey_profile.length ? ' OK' : ' truncated'));

        return journey_profile;
    }


    // ******************************************************************************
    // General state update useful functions
    // ******************************************************************************

    // Normalize an array to values 0..1, with sum 1.0 via exponential softmax function
    function softmax(vector) {
        // Each element x -> exp(x) / sum(all exp(x))
        var denominator =  vector.map(x => Math.exp(x)).reduce( (sum, x) => sum + x );
        return vector.map( x => Math.exp(x) / denominator);
    }

    // Normalize an array to values 0..1, with sum 1.0 via linear scaling function
    function linear_adjust(vector)
    {
        // Each element x -> x/ sum(all x)
        var denominator =  vector.reduce( (sum, x) => sum + x );
        return vector.map( x => x / denominator);
    }

    // Return printable version of probability vector (array with all elements 0..1)
    // E.g. vector_to_string([0.1,0.2,0.0,0.3],'0','[','{',[1,2])
    // where
    // vector: [0.1,0.2,0.0,0.3] is the vector to draw
    // zero_value: '0' is the zero value to use (to reduce the print clutter)
    // max_flag: '[' is the flag to use to highlight the maximum unless correct
    // correct_flag: '{' is the flag to use to highlight the correct maximum
    // correct_cells: [1,2] are the cells that if maximum are considered correct
    function vector_to_string(vector, zero_value, max_flag, correct_flag, correct_cells)
    {
        if (!zero_value)
        {
            zero_value =  '-';
        }
        if (!max_flag)
        {
            max_flag = '[';
        }

        if (!correct_flag || !correct_cells)
        {
            correct_cells = [];
        }

        var str = '';
        // find index of largest element
        var max_value = 0;
        var max_index = 0;
        for (var i=0; i<vector.length; i++)
        {
            if (vector[i] > max_value)
            {
                max_value = vector[i];
                max_index = i;
            }
        }

        // Build print string
        for (var i=0; i<vector.length; i++)
        {
            // Compute leading spacer
            var spacer = ' ';

            if (correct_cells.includes(i))
            {
                spacer = correct_flag;
            }
            else if (i == max_index)
            {
                spacer = max_flag;
            }

            // Print the spacer + value
            //
            str += spacer;

            var n = vector[i];

            // Print zero or value
            if (n == 0)
            {
                str += ' '+zero_value+' ';
            }
            else if (n == 1)
            {
                str += '1.0';
            }
            else // Print value
            {
                var n3 = Math.floor(n*100)/100;
                if (n3==0)
                {
                    str += '.00';
                }
                else
                {
                    str += (''+Math.floor(n*100)/100+'00').slice(1,4);
                }
            }
        }
        return str;
    }

    // return decimals(34.567,2) as '34.57'
    function decimals(n, d)
    {
        var m = Math.pow(10,d);
        return ''+Math.round(n*m)/m;
    }

    // Convert hh:mm:ss to seconds
    function get_seconds(time)
    {
        return parseInt(time.slice(0,2))*3600 + parseInt(time.slice(3,5))*60 + parseInt(time.slice(6,8));
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

    // Return the integer number of 'seconds since midnight' of timestamp in this data record
    function get_msg_day_seconds(msg)
    {
        var msg_date = get_msg_date(msg);
        return msg_date.getSeconds() + 60 * msg_date.getMinutes() + 3600 * msg_date.getHours();
    }


}

