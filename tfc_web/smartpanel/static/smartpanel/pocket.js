/* globals ons,
           RTMonitorAPI, BusStopChooser,
           Weather, StationBoard, StopTimetable, StopBusMap,
           WIDGET_CONFIG, STATIC_URL, RT_TOKEN
*/

/* exported DEBUG */

'use strict';

// Widget spec requires a DEBUG global (even if empty)
var DEBUG = '';
// var DEBUG = 'weather_log station_board_log stop_timetable_log stop_bus_map_log rtmonitor_api_log';
// var DEBUG = 'stop_bus_map_log stop_timetable_log rtmonitor_api_log';

var VERSION = '2.02';
// 2.02 modified Edit..Delete confirm notificatio, added version, click-to-reload to page debug string
// 2.01 moved debug id and timestamp to bottom of page
// 2.00 Working Pocket Smartpanel

// Version number of the agreed TCs
var TCS_VERSION = 1;

var VERSION_KEY = 'POCKET_SMARTPANEL_TCS_VERSION';
var PAGES_KEY = 'POCKET_SMARTPANEL_PAGES';
var INSTANCE_KEY_NAME = 'POCKET_SMARTPANEL_INSTANCE';

// Available weather stations and their names
var WEATHER_OPTIONS = [
    { value: '310042', text: 'Cambridge' },
    { value: '324249', text: 'Ely' },
    { value: '351524', text: 'Fulbourn' },
    { value: '324061', text: 'Huntingdon' },
    { value: '310105', text: 'Luton' },
    { value: '310120', text: 'Peterborough' },
    { value: '353656', text: 'Stansted' },
    { value: '353330', text: 'St. Neots' }
];

// Available train station and their names
var STATION_OPTIONS = [
    { value: 'CBG', text: 'Cambridge' },
    { value: 'CMB', text: 'Cambridge North' },
    { value: 'ELY', text: 'Ely' },
    { value: 'FXN', text: 'Foxton' },
    { value: 'HUN', text: 'Huntingdon' },
    { value: 'MCH', text: 'March' },
    { value: 'MEL', text: 'Meldreth' },
    { value: 'PBO', text: 'Peterborough' },
    { value: 'RYS', text: 'Royston' },
    { value: 'SDY', text: 'Sandy' },
    { value: 'SED', text: 'Shelford' },
    { value: 'SNO', text: 'St. Neots' },
    { value: 'STH', text: 'Shepreth' },
    { value: 'SVG', text: 'Stevenage' },
    { value: 'WBC', text: 'Waterbeach' },
    { value: 'WLF', text: 'Whittlesford' }
];

var UCALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var DIGITS = '0123456789';

// Icon url (relative to STATIC_URL) for each widget
var WIDGET_ICON = {
    'weather': 'weather/weather.png',
    'station_board': 'station_board/br-logo.png',
    'stop_timetable': 'stop_timetable/bus.png',
};

var WIDGET_NAME = {
    'weather': 'weather forecast',
    'station_board': 'train timetable',
    'stop_timetable': 'bus timetable'
};

// Pre-defined destinations for the bus timetable
var DESTINATIONS = [
    {
        area: [
            {
                lat: 52.17570364175672,
                lng: 0.14228330925107005
            },
            {
                lat: 52.175488800588674,
                lng: 0.1444551441818476
            },
            {
                lat: 52.176017346023265,
                lng: 0.14606296084821227
            },
            {
                lat: 52.17649558019505,
                lng: 0.14505780301988128
            },
            {
                lat: 52.17622663512504,
                lng: 0.14254231005907061
            }
        ],
        description: 'Hospital'
    },
    {
        area: [
            {
                lat: 52.205272570950065,
                lng: 0.12231070082634689
            },
            {
                lat: 52.20584108642862,
                lng: 0.12381173204630615
            },
            {
                lat: 52.20498217848623,
                lng: 0.12558894697576764
            },
            {
                lat: 52.20354579109039,
                lng: 0.12294583953917028
            },
            {
                lat: 52.204710238021654,
                lng: 0.12170623987913133
            }
        ],
        description: 'City Centre'
    },
    {
        area: [
            {
                lat: 52.32328491326036,
                lng: -0.07158505730330945
            },
            {
                lat: 52.3232474380255,
                lng: -0.07017082069069148
            },
            {
                lat: 52.322305705435205,
                lng: -0.07021650206297637
            },
            {
                lat: 52.32234784355564,
                lng: -0.07179640699177982
            }
        ],
        description: 'St Ives Bus Station'
    },
    {
        area: [
            {
                lat: 52.19371446386684,
                lng: 0.1361500192433596
            },
            {
                lat: 52.19349174821103,
                lng: 0.1370208151638508
            },
            {
                lat: 52.1922004274234,
                lng: 0.13610429596155885
            },
            {
                lat: 52.19241752500701,
                lng: 0.1352344220504165
            }
        ],
        description: 'Station'
    }
];

// Widget spec requires a RTMONITOR_API global
var RTMONITOR_API;

// List of configured widget instances
var PAGES = [];
// Currently displayed widget
var current_widget;
// stop_map widget object
var map_widget;
// Current instance_key
var instance_key;

// App startup
ons.ready(function () {

    // Setup back button
    if (window.history && window.history.pushState) {
        document.querySelector('#myNavigator').addEventListener('postpush', function() {
            history.pushState({}, '');
        });

        window.onpopstate = function() {
            var navigator = document.querySelector('#myNavigator');
            // If there's more than one page on the stack then pop all but the first
            if (navigator.pages.length > 1) {
                var times = navigator.pages.length - 1;
                navigator.popPage({times: times, animation: 'slide-ios, fade-md'});
            }
            // Otherwise just go back
            else {
                window.history.back();
            }
        };
    }

    // Retrieve the configuration
    if (localStorage.getItem(PAGES_KEY)) {
        PAGES = JSON.parse(localStorage.getItem(PAGES_KEY));
    }
    else {
        PAGES = [];
    }

    // If PRELOAD_PAGES are available, merge those.
    if (PRELOAD_PAGES) {
        merge_preload(PAGES, JSON.parse(PRELOAD_PAGES));
        history.pushState(null,null,POCKET_URL); // provided by template
    }
    // Opening page depends on value stored under VERSION_KEY in localStorage
    var raw_version = localStorage.getItem(VERSION_KEY);
    if (raw_version && parseInt(raw_version) >= TCS_VERSION) {
        document.querySelector('#myNavigator').pushPage('list.html');
    }
    else {
        document.querySelector('#myNavigator').pushPage('first.html');
    }

});

// Merge the 'preload' pages provided by the template into the current pages
function merge_preload(current_pages, preload_pages) {

    // append each preload page if it is not already in current pages
    for (var i=0; i<preload_pages.length; i++) {
        append_page(current_pages, preload_pages[i]);
    }

    // cache combined result back in localStorage
    localStorage.setItem(PAGES_KEY, JSON.stringify(current_pages));
}

// append page to current_pages if it is not already in list
function append_page(current_pages, page) {
    for (var i=0; i<current_pages.length; i++) {
        if (page_match(current_pages[i],page)) {
            // page is already in list of current pages, so do nothing and return
            return;
        }
    }
    current_pages.push(page);
}

// return true if two pages are the same, e.g
// weather/Cambridge == weather/Cambridge
function page_match(page1, page2) {
   return (page1.widget == page2.widget && page1.title == page2.title)
}

// Add listener for user backgrounding this 'app'
// If page becomes 'visible' *after* RELOAD_TIME then page will be reloaded (and get new rt_token)
// If page becomes 'hidden' then it will force RTMONITOR_API to disconnect
document.addEventListener("visibilitychange", function(event) {

    var visibility_state = document.visibilityState;

    if (visibility_state == 'visible') {
        console.log('visibilitystate visible');
        var visible_time = new Date();
        if (visible_time > RELOAD_TIME) { // RELOAD_TIME set in pocket.html to 4:30am tomorrow morning
            console.log('visibilitychange reloading page');
            document.body.innerHTML = '<h1 style="font-family: sans-serif;">Reloading...</h1>';
            location.reload(true);
        } else {
            console.log('visibilitychange no reload');
            if (RTMONITOR_API) {
                console.log('visibilitystate reconnecting rtmonitor_api');
                RTMONITOR_API.connect();
            }
        }
    }

    if (visibility_state == 'hidden') {
        console.log('visibilitystate hidden');
        if (RTMONITOR_API) {
            console.log('visibilitystate disconnecting rtmonitor_api');
            RTMONITOR_API.disconnect();
        }
    }
    //var ons_page = event.target;

}); // end "visibilitychange" event listener

// Page initialisation handlers
document.addEventListener('init', function(event) {
    var ons_page = event.target;
    var navigator = document.querySelector('#myNavigator');

    // First page ------------------------------------------------------

    if (ons_page.id === 'first') {
        ons_page.querySelector('a').addEventListener('click', function() {
            navigator.pushPage('tcs.html');
        });
        ons_page.querySelector('#accept').addEventListener('click', function() {
            localStorage.setItem(VERSION_KEY, TCS_VERSION.toString());
            navigator.replacePage('list.html');
        });
    }

    // Page list -------------------------------------------------------

    else if (ons_page.id === 'list') {

        instance_key = localStorage.getItem(INSTANCE_KEY_NAME);
        if (!instance_key || /^\d+$/.test(instance_key)) {
            instance_key = generate_instance_key();
            localStorage.setItem(INSTANCE_KEY_NAME, instance_key);
        }
        send_beacon('list'); // module_id=pocket&instance_id=instance_key&component_id=list
        ons_page.querySelector('#debug_string').innerHTML = instance_key+' / '+VERSION+' / '+LOAD_TIME;
        ons_page.querySelector('#debug_string').addEventListener('click',reload_page);

        ons_page.querySelector('#add').addEventListener('click', choose_new_page);
        if (PAGES.length === 0) {
        //    document.querySelector('#first-time').show('#add', {direction: 'up'});
            choose_new_page();
        }

        ons_page.querySelector('.page-list').addEventListener('click', handle_page_list_click);

        ons_page.querySelector('#edit').addEventListener('click', function() {
            ons_page.classList.add('edit-mode');
            // Hide the chevron - using Array.prototype.forEach.call to
            // work around lack of nodeList.forEach()
            var nodes = ons_page.querySelectorAll('.page-list ons-list-item');
            Array.prototype.forEach.call(nodes, function(item) {
                ons.modifier.remove(item, 'chevron');
            });
        });
        ons_page.querySelector('#done').addEventListener('click', function() {
            ons_page.classList.remove('edit-mode');
            // Restore the chevron - see above
            var nodes = ons_page.querySelectorAll('.page-list ons-list-item');
            Array.prototype.forEach.call(nodes, function(item) {
                ons.modifier.add(item, 'chevron');
            });
        });

        populate_page_list(ons_page);
    }

    // Page display ----------------------------------------------------

    else if (ons_page.id === 'page-display') {
        // Has to be '.onclick' to replace default action
        ons_page.querySelector('ons-back-button').onClick = function() {
            var times = navigator.pages.length - 1;
            navigator.popPage({times: times, animation: 'slide-ios, fade-md'});
        };
        ons_page.querySelector('#map').addEventListener('click', function() {
            navigator.bringPageTop('map-display.html', {data: ons_page.data, animation: 'fade'});
        });
        display_page(ons_page.data.page_number, ons_page);
    }

    // Stop bus map display --------------------------------------------

    else if (ons_page.id === 'map-display') {
        ons_page.querySelector('ons-back-button').onClick = function() {
            var times = navigator.pages.length - 1;
            navigator.popPage({times: times, animation: 'slide-ios, fade-md'});
        };
        ons_page.querySelector('#timetable').addEventListener('click', function() {
            navigator.bringPageTop('page-display.html', {data: ons_page.data, animation: 'fade'});
        });
        display_map(ons_page);
    }

    // Config display --------------------------------------------------

    else if (ons_page.id === 'config') {
        setup_config(ons_page);

    }

});


// Page destroy handler
document.addEventListener('destroy', function(event) {
    var ons_page = event.target;

    if (ons_page.id === 'page-display') {
        if (current_widget && 'close' in current_widget) {
            current_widget.close();
        }
        current_widget = undefined;
    }
    else if (ons_page.id === 'map-display') {
        if (map_widget && 'close' in map_widget) {
            map_widget.close();
        }
        map_widget = undefined;
    }

});

// Force fresh (non-cached) http GET of pocket.html
function reload_page() {
    document.body.innerHTML = '<h1 style="font-family: sans-serif;">Reloading...</h1>';
    location.reload(true);
}

// Handle a click on a page entry in the page list
function handle_page_list_click(evt) {

    var list_item = evt.target.closest('ons-list-item');
    if (!list_item) {
        return;
    }
    var page_number = getElementIndex(list_item);
    var ons_page = list_item.closest('ons-page');
    var navigator = document.querySelector('#myNavigator');

    // A click on a delete icon
    if (evt.target.closest('.delete')) {
        delete_page(page_number, ons_page);
    }
    //Otherwise a click when editing
    else if (ons_page.classList.contains('edit-mode')) {
        // this commented line is alternative "edit the config for the page"
        //navigator.pushPage('config.html', {data: { page_number: page_number }});
        delete_page(page_number, ons_page);
    }
    // Otherwise
    else {
        navigator.pushPage('page-display.html', {data: { page_number: page_number }});
    }

}

function delete_page(page_number, ons_page) {
    var page_title = PAGES[page_number].title;
    var page_widget = PAGES[page_number].widget;
    ons.notification.confirm({message: 'Delete the ' + WIDGET_NAME[page_widget] + ' for ' + page_title + '?',
                              title: 'Edit',
                              buttonLabels: ['Cancel','DELETE']
                             })
        .then(function(button) {
            if (button === 1) {
                PAGES.splice(page_number, 1);
                localStorage.setItem(PAGES_KEY, JSON.stringify(PAGES));
                populate_page_list(ons_page);
            }
        });
}

// Display page page_number on page
function display_page(page_number, ons_page) {

    var page_config = PAGES[page_number];
    var widget_type = page_config.widget;

    var widget_container = ons_page.querySelector('#widget-container');
    clear_element(widget_container);

    var container_el = document.createElement('div');
    container_el.id = 'widget-' + widget_type;
    container_el.classList.add('widget', widget_type);
    widget_container.appendChild(container_el);

    ons_page.querySelector('#map').classList.add('hidden');
    switch (widget_type) {
    case 'weather':
        // send log query to /smartcambridge/logger
        send_beacon('weather', { component_ref: page_config.data.location });
        current_widget = new Weather('weather');
        break;
    case 'station_board':
        // send log query to /smartcambridge/logger
        send_beacon('station_board', { component_ref: page_config.data.station });
        current_widget = new StationBoard('station_board');
        break;
    case 'stop_timetable':
        // send log query to /smartcambridge/logger
        send_beacon('stop_timetable', { component_ref: page_config.data.stop.id });
        current_widget = new StopTimetable('stop_timetable');
        ons_page.querySelector('#map').classList.remove('hidden');
        RTMONITOR_API = new RTMonitorAPI({
                                            rt_client_id: instance_key,
                                            rt_client_name: 'Pocket SmartPanel V'+VERSION,
                                            rt_token: RT_TOKEN // from tfc_web..pocket.html
                                         },
                                         RTMONITOR_URI); // from tfc_web..pocket.html
        break;
    }

    current_widget.display(
        {
            container_id: 'widget-' + widget_type,
            static_url: STATIC_URL + page_config.widget + '/',
            display_id: instance_key,
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: '',
            display_name: 'Pocket SmartPanel',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        page_config.data
    );

//    if (widget_type === 'stop_timetable') {
//        RTMONITOR_API.init();
//    } // not needed with current rtmonitor_api version

}


// Display a stop_bus_map widget for the stop_timetable currently being displayed
function display_map(ons_page) {

    // Get the config for the stop_timetable currently being displayed
    var timetable_config = PAGES[ons_page.data.page_number];

    // Synthesise a stop_bus_map widget config
    var map_config = {
        'title': timetable_config.data.title,
        'map': {
            'zoom': 15,
            'lat': timetable_config.data.stop.latitude,
            'lng': timetable_config.data.stop.longitude,
        },
        'breadcrumbs': true,
        'stops': [
            timetable_config.data.stop
        ]
    };

    var overlay_container = ons_page.querySelector('#overlay-container');
    clear_element(overlay_container);

    var container_el = document.createElement('div');
    container_el.id = 'widget-stop_bus_map';
    container_el.classList.add('widget', 'stop_bus_map', 'full-screen');
    overlay_container.appendChild(container_el);

    map_widget = new StopBusMap('stop_bus_map');
    map_widget.display(
        {
            container_id: 'widget-stop_bus_map',
            static_url: STATIC_URL + 'stop_bus_map/',
            display_id: instance_key,
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: '',
            display_name: 'Pocket SmartPanel',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        map_config
    );
}

// (Re-)populate the list on the 'pages' page with the current pages
function populate_page_list(ons_page) {
    var list = ons_page.querySelector('.page-list');

    // Remove existing entries
    clear_element(list);

    // Populate
    for (var page_number = 0; page_number < PAGES.length; page_number++) {
        var page_config = PAGES[page_number];
        var item = document.createElement('ons-list-item');
        item.setAttribute('tappable', '');
        ons.modifier.add(item, 'longdivider');
        // Add the chevron if not in edit mode
        if (!ons_page.classList.contains('edit-mode')) {
            ons.modifier.add(item, 'chevron');
        }

        item.innerHTML =
            '<div class="left">' +
            '  <img class="list-item__icon list-icon" src=" ' + STATIC_URL + WIDGET_ICON[page_config.widget] +'"/>' +
            '</div>' +
            '<div class="center">' +
            '  ' + page_config.title +
            '</div>' +
            '<div class="right">' +
            '  <span class="show-edit delete">' +
            '    <ons-icon icon="ion-ios-trash, material:ion-android-delete" size="28px, material:lg">' +
            '    </ons-icon>' +
            '  </span>' +
            '</div>';

        list.appendChild(item);
    }

}


// Display an ActionSheet to select a page type
function choose_new_page() {
    ons.openActionSheet({
        title: 'Choose a page type',
        cancelable: true,
        buttons: [
            'Bus timetable',
            'Train timetable',
            'Weather forecast',
            {
                label: 'Cancel',
                icon: 'md-close'
            }
        ]
    }).then(function (index) {
        var navigator = document.querySelector('#myNavigator');
        switch (index) {
        case 0:
            navigator.pushPage('config.html', { data: { new_widget: 'stop_timetable' } });
            break;
        case 1:
            navigator.pushPage('config.html', { data: { new_widget: 'station_board' } });
            break;
        case 2:
            navigator.pushPage('config.html', { data: { new_widget: 'weather' } });
            break;
        }
    });

}


// Set up the config page
function setup_config(ons_page) {

    var current_params;
    var page_number = ons_page.data.page_number;
    // If we have a page number than it's an existing page
    if (page_number !== undefined) {
        current_params = PAGES[page_number];
    }
    // Otherwise it's a new page
    else {
        current_params = {
            widget: ons_page.data.new_widget,
            data: {}
        };
    }

    var config = {
        static_url: STATIC_URL + current_params.widget + '/',
        display_id: instance_key,
        layout_id: '',
        rt_token: RT_TOKEN,
        layout_name: '',
        display_name: 'Pocket SmartPanel',
        layout_owner: '',
        display_owner: '',
        settings: WIDGET_CONFIG
    };

    var config_el = ons_page.querySelector('.config-area');
    var submit_button = ons_page.querySelector('#submit');

    var new_params_callback;
    switch (current_params.widget) {
    case 'weather':
        ons_page.querySelector('ons-toolbar .center').textContent = 'Choose location';
        new_params_callback = weather_config(config_el, config, current_params);
        break;
    case 'station_board':
        ons_page.querySelector('ons-toolbar .center').textContent = 'Choose station';
        new_params_callback = station_board_config(config_el, config, current_params);
        break;
    case 'stop_timetable':
        ons_page.querySelector('ons-toolbar .center').textContent = 'Choose bus stop';
        new_params_callback = stop_timetable_config(config_el, config, current_params, function (n) {
            submit_button.disabled = (n === 0);
        });
        break;
    }

    submit_button.addEventListener('click', function() {
        // New page (notepage_numbr can be 0 and hence false...)
        if (page_number === undefined) {
            PAGES.push(new_params_callback());
            localStorage.setItem(PAGES_KEY, JSON.stringify(PAGES));
        }
        // Edited existing page
        else {
            PAGES[page_number] = new_params_callback();
            localStorage.setItem(PAGES_KEY, JSON.stringify(PAGES));
        }
        // Re-populate the list of available pages
        populate_page_list(document.querySelector('#list'));
        document.querySelector('#myNavigator').popPage();
    });

    ons_page.querySelector('#cancel').addEventListener('click', function() {
        document.querySelector('#myNavigator').popPage();
    });

}


// Configuration helper for weather pages
function weather_config(config_el, config, current_params) {

    var result = list_chooser(config_el, current_params.data.location, WEATHER_OPTIONS);

    return function () {
        return {
            widget: current_params.widget,
            title: result().text,
            data: {
                location: result().value
            }
        };
    };
}

/// Configuration helper for train timetable pages
function station_board_config(config_el, config, current_params) {

    var result = list_chooser(config_el, current_params.data.station, STATION_OPTIONS);

    return function () {
        return {
            widget: current_params.widget,
            title: result().text,
            data: {
                station: result().value,
                platforms: 'y'
            }
        };
    };
}

// Configuration helper for bus timetable pages
function stop_timetable_config(config_el, config, current_params, stops_callback) {

    var chooser_options = {
        multi_select: false,
        popups: true,
        location: true,
        stops_callback: stops_callback,
        api_endpoint: config.settings.SMARTPANEL_API_ENDPOINT,
        api_token: config.settings.SMARTPANEL_API_TOKEN
    };
    var chooser = BusStopChooser.create(chooser_options);
    if (current_params.data.stop) {
        chooser.render(config_el, { stops: [current_params.data.stop] });
    }
    else {
        chooser.render(config_el);
    }

    return function () {
        var stop = chooser.getData().stops[0];
        var title = formatted_stop_name(stop.indicator, stop.common_name);
        return {
            widget: current_params.widget,
            title: title,
            data: {
                stop: stop,
                title: title,
                layout: 'multiline',
                destinations: DESTINATIONS,
            }
        };
    };
}

// Display a list chooser in `el` populated with items taken from `VALUES`.
// Select the row identified by `current` if defined, else the first row.
// Return a function that returns an object containing the selected value and
// text.
function list_chooser(el, current, VALUES) {

    var choosen_row;

    var list = document.createElement('ons-list');
    list.setAttribute('modifier', 'inset');
    for (var row = 0; row < VALUES.length; ++row) {
        var element = VALUES[row];
        var list_item = document.createElement('ons-list-item');
        list_item.setAttribute('tappable', 'true');
        list_item.innerHTML =
            '<label class="left">' +
            '  <ons-radio name="choice" input-id="' + element.value + '""></ons-radio>' +
            '</label>' +
            '<label for="' + element.value +'" class="center">' +
                element.text +
            '</label>';
        if (current === element.value) {
            choosen_row = row;
            list_item.querySelector('ons-radio').setAttribute('checked', 'true');
        }
        list.appendChild(list_item);
    }

    if (choosen_row === undefined) {
        choosen_row = 0;
        list.childNodes[0].querySelector('ons-radio').setAttribute('checked', 'true');
    }

    list.addEventListener('click', function(evt) {
        var this_item = evt.target.closest('ons-list-item');
        choosen_row = getElementIndex(this_item);
    });
    el.appendChild(list);

    return function() {
        return {
            value: VALUES[choosen_row].value,
            text: VALUES[choosen_row].text
        };
    };

}

function formatted_stop_name(indicator, common_name) {

    // Fix up abbreviations
    switch (indicator) {
    case 'opp':
        indicator = 'opposite';
        break;
    case 'o/s':
    case 'os':
        indicator = 'outside';
        break;
    case 'adj':
    case 'adjacent':
        indicator = 'adjacent to';
        break;
    case 'nr':
        indicator = 'near';
        break;
    case 'cnr':
        indicator = 'corner';
        break;
    }

    if (indicator === undefined) {
        indicator = '';
    }

    if ( [
        'opposite', 'outside', 'adjacent to', 'near', 'behind', 'inside', 'by', 'in',
        'at', 'on', 'before', 'just before', 'after', 'just after', 'corner of'].indexOf(indicator) >= 0) {
        return indicator.charAt(0).toUpperCase() + indicator.slice(1) + ' ' + common_name;
    }
    else {
        return common_name + ' (' + indicator + ')';
    }
}


function generate_instance_key() {
    return random_chars(UCALPHA, 4) +
           '-' +
           random_chars(DIGITS, 4);
}

// Make an async request to a logging endpoint which must receive:
// module_id: required string, in this case 'pocket'
// instance_id: required string, a unique reference for this pocket instance
// component_id: required string, 'page' | 'stop_timetable', 'stop_bus_map', ...
// params: optional dictionary, should include 'component_ref' as definitive id e.g. '0500CCITY423' for stop_timetable
//
// module_id is hard_coded into this routine as 'pocket', so it it not needed in the call.
// instance_key is a global variable so is not needed in the call.
// e.g.
// send_beacon('stop_timetable',
//             { component_ref: '0500CCITY423' }
//            );
function send_beacon(component_id, params) {
    var uri = '/smartcambridge/logger/';
    uri += encodeURIComponent('pocket')+'/';     // module_id
    uri += encodeURIComponent(instance_key)+'/'; // global var

    uri += encodeURIComponent(component_id)+'/';

    // add (optional) params to querystring
    var params_count = 0
    if (params) {
        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                params_count++;
                var qs_join = params_count == 1 ? '?' : '&';
                uri += qs_join + key + '=' + encodeURIComponent(params[key]);
            }
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.send();
}


/* UTILITIES */

// Find the position of an element within its containing element
function getElementIndex(el) {
    var index = 0;
    while ( (el = el.previousElementSibling) ) {
        index++;
    }
    return index;
}

// Remove all the child elements of el
function clear_element(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}


// Choose `count` characters at random from `chars`
function random_chars(chars, count) {
    var result = '';
    for (var i = 0; i < count; ++i) {
        var rnum = Math.floor(Math.random() * chars.length);
        result += chars.substring(rnum, rnum+1);
    }
    return result;
}


// Polyfill for element.closest
// https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector ||
                                Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
        var el = this;
        if (!document.documentElement.contains(el)) {
            return null;
        }
        do {
            if (el.matches(s)) {
                return el;
            }
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}
