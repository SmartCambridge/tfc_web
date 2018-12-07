/* globals ons,
           RTMonitorAPI, BusStopChooser,
           Weather, StationBoard, StopTimetable, StopBusMap,
           WIDGET_CONFIG, STATIC_URL, RT_TOKEN
*/

'use strict';

// Widget spec requires a DEBUG global (even if empty)
// var DEBUG = '';
var DEBUG = 'weather_log station_board_log stop_timetable_log stop_bus_map_log rtmonitor_api_log';
// var DEBUG = 'rtmonitor_api_log';

// Version number of the agreed TCs
var TCS_VERSION = 1;

var VERSION_KEY = 'POCKET_SMARTPANEL_TCS_VERSION';
var PAGES_KEY = 'POCKET_SMARTPANEL_PAGES';

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

// Widget spec requires a RTMONITOR_API global
var RTMONITOR_API;

// List of configured widget instances
var PAGES = [];
// Currently displayed widget
var current_widget;
// stop_map widget object
var map_widget;


// App startup
ons.ready(function () {

    console.log('Running ready()');

    // Retrieve the configuration
    if (localStorage.getItem(PAGES_KEY)) {
        PAGES = JSON.parse(localStorage.getItem(PAGES_KEY));
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


// Page initialisation handlers
document.addEventListener('init', function(event) {
    var ons_page = event.target;
    var navigator = document.querySelector('#myNavigator');

    console.log('Running init for ' + ons_page.id);

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
        ons_page.querySelector('#add').addEventListener('click', choose_new_page);
        if (PAGES.length === 0) {
        //    document.querySelector('#first-time').show('#add', {direction: 'up'});
            choose_new_page();
        }

        ons_page.querySelector('.page-list').addEventListener('click', handle_page_list_click);

        ons_page.querySelector('#edit').addEventListener('click', function() {
            ons_page.classList.add('edit-mode');
            // Hide the chevron
            ons_page.querySelectorAll('.page-list ons-list-item').forEach(function(item) {
                item.setAttribute('modifier', 'longdivider');
            });
        });
        ons_page.querySelector('#done').addEventListener('click', function() {
            ons_page.classList.remove('edit-mode');
            // Restore the chevron
            ons_page.querySelectorAll('.page-list ons-list-item').forEach(function(item) {
                item.setAttribute('modifier', 'chevron longdivider');
            });
        });

        populate_page_list(ons_page);
    }

    // Page display ----------------------------------------------------

    else if (ons_page.id === 'page-display') {
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


// page display handler
document.addEventListener('show', function(event) {
    var ons_page = event.target;

    console.log('Running show for ' + ons_page.id);

});


// Page hide display
document.addEventListener('hide', function(event) {
    var ons_page = event.target;

    console.log('Running hide for ' + ons_page.id);

});


// Page destroy handler
document.addEventListener('destroy', function(event) {
    var ons_page = event.target;

    console.log('Running destroy for ' + ons_page.id);

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
        var page_title = PAGES[page_number].title;
        var page_widget = PAGES[page_number].widget;
        ons.notification.confirm({message: 'Delete the ' + WIDGET_NAME[page_widget] + ' for ' + page_title + '?'})
            .then(function(button) {
                if (button === 1) {
                    PAGES.splice(page_number, 1);
                    localStorage.setItem(PAGES_KEY, JSON.stringify(PAGES));
                    populate_page_list(ons_page);
                }
            });
    }
    //Otherwise a click when editing
    else if (ons_page.classList.contains('edit-mode')) {
        navigator.pushPage('config.html', {data: { page_number: page_number }});
    }
    // Otherwise
    else {
        navigator.pushPage('page-display.html', {data: { page_number: page_number }});
    }

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

    ons_page.querySelector('#map').hidden = true;
    switch (widget_type) {
    case 'weather':
        current_widget = new Weather('weather');
        break;
    case 'station_board':
        current_widget = new StationBoard('station_board');
        break;
    case 'stop_timetable':
        current_widget = new StopTimetable('stop_timetable');
        ons_page.querySelector('#map').hidden = false;
        RTMONITOR_API = new RTMonitorAPI({
            rt_client_id: 'pocket_smartpanel',
            rt_client_name: 'Pocket SmartPanel',
            rt_token: RT_TOKEN});
        break;
    }

    current_widget.display(
        {
            container_id: 'widget-' + widget_type,
            static_url: STATIC_URL + page_config.widget + '/',
            display_id: '',
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: 'Layouts for mobile',
            display_name: '',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        page_config.data
    );

    if (widget_type === 'stop_timetable') {
        RTMONITOR_API.init();
    }

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
            display_id: '',
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: 'Layouts for mobile',
            display_name: '',
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

        // Don't add the chevron in edit mode
        if (ons_page.classList.contains('edit-mode')) {
            item.setAttribute('modifier', 'longdivider');
        }
        else {
            item.setAttribute('modifier', 'chevron longdivider');
        }

        item.innerHTML =
            '<div class="left">' +
            '  <img class="list-item__icon list-icon" src=" ' + STATIC_URL + WIDGET_ICON[page_config.widget] +'"/>' +
            '</div>' +
            '<div class="center">' +
            '  ' + page_config.title +
            '</div>' +
            '<div class="right">' +
            '  <span class="delete">' +
            '    <ons-icon icon="ion-ios-trash, material:ion-android-delete" size="18px, material:lg">' +
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
        display_id: '',
        layout_id: '',
        rt_token: RT_TOKEN,
        layout_name: 'Layouts for mobile',
        display_name: '',
        layout_owner: '',
        display_owner: '',
        settings: WIDGET_CONFIG
    };

    var config_el = ons_page.querySelector('.config-area');
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
        new_params_callback = stop_timetable_config(config_el, config, current_params);
        break;
    }

    ons_page.querySelector('#submit').addEventListener('click', function() {
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

    var select = document.createElement('ons-select');
    WEATHER_OPTIONS.forEach(function (element) {
        var option = document.createElement('option');
        option.setAttribute('value', element.value);
        option.textContent = element.text;
        if (current_params.data.location === element.value) {
            option.setAttribute('selected', 'true');
        }
        select.appendChild(option);
    });
    config_el.appendChild(select);

    return function () {
        var location = select.value;
        var title = '';
        for (var i=0; i<WEATHER_OPTIONS.length; i++) {
            if (WEATHER_OPTIONS[i].value === location) {
                title = WEATHER_OPTIONS[i].text;
                break;
            }
        }
        return {
            widget: current_params.widget,
            title: title,
            data: {
                location: location
            }
        };
    };
}

/// Configuration helper for train timetable pages
function station_board_config(config_el, config, current_params) {

    var select = document.createElement('ons-select');
    STATION_OPTIONS.forEach(function (element) {
        var option = document.createElement('option');
        option.setAttribute('value', element.value);
        option.textContent = element.text;
        if (current_params.data.location === element.value) {
            option.setAttribute('selected', 'true');
        }
        select.appendChild(option);
    });
    config_el.appendChild(select);

    return function () {
        var station = select.value;
        var title = '';
        for (var i=0; i<STATION_OPTIONS.length; i++) {
            if (STATION_OPTIONS[i].value === station) {
                title = STATION_OPTIONS[i].text;
                break;
            }
        }
        return {
            widget: current_params.widget,
            title: title,
            data: {
                station: station
            }
        };
    };
}


// Configuration helper for bus timetable pages
function stop_timetable_config(config_el, config, current_params) {

    var chooser_options = {
        multi_select: false,
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
        var title = stop.indicator + ' ' + stop.common_name;
        return {
            widget: current_params.widget,
            title: title,
            data: {
                stop: stop,
                title: title,
                layout: 'multiline',
            }
        };
    };
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
