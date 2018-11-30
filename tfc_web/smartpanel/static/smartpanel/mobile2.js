/* globals ons,
           RTMonitorAPI, WidgetConfig, BusStopChooser,
           Weather, StationBoard, StopTimetable, StopBusMap,
           WIDGET_CONFIG, STATIC_URL, RT_TOKEN, DEBUG
*/

'use strict';

// Widget spec requires a DEBUG global
var DEBUG = 'weather_log station_board_log stop_timetable_log stop_bus_map_log rtmonitor_api_log';

var RTMONITOR_API;

const WEATHER_OPTIONS = [
    { value: '310042', text: 'Cambridge' },
    { value: '324249', text: 'Ely' },
    { value: '351524', text: 'Fulbourn' },
    { value: '324061', text: 'Huntingdon' },
    { value: '310105', text: 'Luton' },
    { value: '310120', text: 'Peterborough' },
    { value: '353656', text: 'Stansted' },
    { value: '353330', text: 'St. Neots' }
];

const STATION_OPTIONS = [
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

const TCS_VERSION = 1;

const STORAGE = window.localStorage;

let PANELS = [];
let current_widget;
let map_widget;

ons.ready(function () {

    console.log('Running ready()');

    // Retrieve the configuration
    if (STORAGE.getItem('MOBILE_PANELS')) {
        PANELS = JSON.parse(STORAGE.getItem('MOBILE_PANELS'));
    }

    // Opening page depends in STORAGE.TCS_VERSION
    let raw_version = STORAGE.getItem('TCS_VERSION');
    if (raw_version && parseInt(raw_version) >= TCS_VERSION) {
        document.querySelector('#myNavigator').pushPage('panels.html');
    }
    else {
        document.querySelector('#myNavigator').pushPage('first.html');
    }

});


document.addEventListener('init', function(event) {
    let page = event.target;

    console.log(`Running init for ${page.id}`);

    if (page.id === 'first') {
        page.querySelector('#accept').addEventListener('click', function() {
            STORAGE.setItem('TCS_VERSION', TCS_VERSION.toString());
            document.querySelector('#myNavigator').pushPage('panels.html');
        });
    }

    else if (page.id === 'panels') {
        page.querySelector('#add').addEventListener('click', choose_new_panel);
        page.querySelector('.panel-items').addEventListener('click', function(evt) {
            let list_item = evt.target.closest('ons-list-item');
            if (!list_item) {
                return;
            }
            let panel_number = getElementIndex(list_item);
            if (evt.target.closest('.item-delete')) {
                console.log(`Delete ${panel_number}`);
                let panel_title = PANELS[panel_number].title;
                ons.notification.confirm({message: `OK to delete smartpanel for '${panel_title}'?`})
                    .then(function(button) {
                        if (button === 1) {
                            PANELS.splice(panel_number, 1);
                            STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                            populate_panel_list(page);
                        }
                    });
            }
            else if (page.classList.contains('edit-mode')) {
                console.log(`Edit ${panel_number}`);
                document.querySelector('#myNavigator').pushPage('config.html', {data: { panel_number }});
            }
            else {
                document.querySelector('#myNavigator').pushPage('panel.html', {data: { panel_number }});
            }
        });
        page.querySelector('#edit').addEventListener('click', function() {
            page.classList.add('edit-mode');
            page.querySelectorAll('.panel-items ons-list-item').forEach(function(item) {
                item.setAttribute('modifier', 'longdivider');
            });
        });
        page.querySelector('#done').addEventListener('click', function() {
            page.classList.remove('edit-mode');
            page.querySelectorAll('.panel-items ons-list-item').forEach(function(item) {
                item.setAttribute('modifier', 'chevron longdivider');
            });
        });
        populate_panel_list(page);
    }

    else if (page.id === 'panel') {
        page.querySelector('#map').addEventListener('click', function() {
            console.log(page.data);
            document.querySelector('#myNavigator').pushPage('map-overlay.html', {data: page.data});
        });
        console.log(page.data);
        display_panel(page);
    }

    else if (page.id === 'map-overlay') {
        display_map(page);
    }

    else if (page.id === 'config') {

        let current_params;
        let panel_number = page.data.panel_number;
        // If we have a panel number than it's an existing widget?
        if (panel_number !== undefined) {
            current_params = PANELS[panel_number];
        }
        // Otherwise it's a new widget
        else {
            current_params = {
                widget: page.data.new_widget,
                data: {}
            };
        }

        let config = {
            static_url: `${STATIC_URL}${current_params.widget}/`,
            display_id: '',
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: 'Layouts for mobile',
            display_name: '',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        };

        let config_el = page.querySelector('.config-area');
        let new_params_callback;
        switch (current_params.widget) {
        case 'weather':
            new_params_callback = weather_config(config_el, config, current_params);
            break;
        case 'station_board':
            new_params_callback = station_board_config(config_el, config, current_params);
            break;
        case 'stop_timetable':
            new_params_callback = stop_timetable_config(config_el, config, current_params);
            break;
        }

        page.querySelector('#submit').addEventListener('click', function() {
            // New panel (note panel_id can be 0 and hence false...)
            if (panel_number === undefined) {
                PANELS.push(new_params_callback());
                STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
            }
            // Edited existing panel
            else {
                PANELS[panel_number] = new_params_callback();
                STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
            }
            // Re-populate the list of available panels
            populate_panel_list(document.querySelector('#panels'));
            document.querySelector('#myNavigator').popPage();
        });

        page.querySelector('#cancel').addEventListener('click', function() {
            document.querySelector('#myNavigator').popPage();
        });
    }

});


function weather_config(config_el, config, current_params) {

    let widget_config = new WidgetConfig(config);

    let config_table = document.createElement('table');
    config_el.appendChild(config_table);

    var location_callbacks = widget_config.input(
        config_table,
        'select',
        {
            text: 'Location:',
            title: 'Choose your weather location from the dropdown',
            options: WEATHER_OPTIONS
        },
        current_params.data.location
    );

    return function () {
        let location = location_callbacks.value();
        let title;
        for (let i=0; i<WEATHER_OPTIONS.length; i++) {
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

function station_board_config(config_el, config, current_params) {

    let widget_config = new WidgetConfig(config);

    let config_table = document.createElement('table');
    config_el.appendChild(config_table);

    var station_callbacks = widget_config.input(
        config_table,
        'select',
        {
            text: 'Station:',
            title: 'Choose your station from the dropdown',
            options: STATION_OPTIONS
        },
        current_params.data.station
    );

    return function () {
        let station = station_callbacks.value();
        let title;
        for (let i=0; i<STATION_OPTIONS.length; i++) {
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


function stop_timetable_config(config_el, config, current_params) {

    let chooser_options = {
        multi_select: false,
        api_endpoint: config.settings.SMARTPANEL_API_ENDPOINT,
        api_token: config.settings.SMARTPANEL_API_TOKEN
    };
    let chooser = BusStopChooser.create(chooser_options);
    if (current_params.data.stop) {
        chooser.render(config_el, { stops: [current_params.data.stop] });
    }
    else {
        chooser.render(config_el);
    }

    return function () {
        let stop = chooser.getData().stops[0];
        let title = `${stop.indicator} ${stop.common_name}`;
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

document.addEventListener('show', function(event) {
    var page = event.target;

    console.log(`Running show for ${page.id}`);

});

document.addEventListener('hide', function(event) {
    var page = event.target;

    console.log(`Running hide for ${page.id}`);

});

document.addEventListener('destroy', function(event) {
    var page = event.target;

    console.log(`Running destroy for ${page.id}`);

    if (page.id === 'panel') {
        if (current_widget) {
            current_widget.close();
        }
    }
    else if (page.id === 'map-overlay') {
        if (map_widget) {
            map_widget.close()
        }
    }

});

function display_panel(page) {
    console.log(page);
    let panel_config = PANELS[page.data.panel_number];
    console.log(panel_config);
    let widget_type = panel_config.widget;

    let widget_container = page.querySelector('#widget-container');
    clear_element(widget_container);

    let container_el = document.createElement('div');
    container_el.id = 'widget-' + widget_type;
    container_el.classList.add('widget', widget_type);
    widget_container.appendChild(container_el);

    page.querySelector('#map').hidden = true;
    switch (widget_type) {
    case 'weather':
        current_widget = new Weather('1');
        break;
    case 'station_board':
        current_widget = new StationBoard('2');
        break;
    case 'stop_timetable':
        current_widget = new StopTimetable('3');
        page.querySelector('#map').hidden = false;
// client_data = { rt_client_id: <unique id for this client>
//                 rt_client_name: <some descriptive name, e.g. display name>
//                 rt_client_url: <location.href of this connecting web page client>
//                 rt_token: <token to be passed to rt_monitor in the connection to validate>
//               }
        RTMONITOR_API = new RTMonitorAPI( { rt_client_id: 'mobile2',
                                            rt_client_name: 'dev mobile panel app',
                                            rt_token: RT_TOKEN

        });
        break;
    }

    current_widget.display(
        {
            container_id: 'widget-' + widget_type,
            static_url: `${STATIC_URL}${panel_config.widget}/`,
            display_id: '',
            layout_id: '',
            rt_token: RT_TOKEN,
            layout_name: 'Layouts for mobile',
            display_name: '',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        panel_config.data
    );

    if (widget_type === 'stop_timetable') {
        RTMONITOR_API.init();
    }

}

function display_map(page) {
    console.log('Dispay map', page);
    let panel_config = PANELS[page.data.panel_number];
    console.log(panel_config);

    // Synthesise a stop_bus_map widget config
    let map_config = {
        'title': panel_config.data.title,
        'map': {
            'zoom': 14,
            'lat': panel_config.data.stop.latitude,
            'lng': panel_config.data.stop.longitude,
        },
        'breadcrumbs': true,
        'stops': [
            panel_config.data.stop
        ]
    };

    let overlay_container = page.querySelector('#overlay-container');
    clear_element(overlay_container);

    let container_el = document.createElement('div');
    container_el.id = 'widget-stop_bus_map';
    container_el.classList.add('widget', 'stop_bus_map', 'full-screen');
    overlay_container.appendChild(container_el);

    map_widget = new StopBusMap('4');
    map_widget.display(
        {
            container_id: 'widget-stop_bus_map',
            static_url: `${STATIC_URL}stop_bus_map/`,
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

const WIDGET_ICON = {
    'weather': 'weather/weather.png',
    'station_board': 'station_board/br-logo.png',
    'stop_timetable': 'stop_timetable/bus.png',
};

// Update the list on the 'pannels' page with the current panels
function populate_panel_list(page) {
    let list = page.querySelector('.panel-items');

    // Remove existing entries
    clear_element(list);

    // Populate
    for (let panel_number = 0; panel_number < PANELS.length; panel_number++) {
        let panel_config = PANELS[panel_number];
        let item = document.createElement('ons-list-item');
        item.setAttribute('tappable', '');
        if (page.classList.contains('edit-mode')) {
            item.setAttribute('modifier', 'longdivider');
        }
        else {
            item.setAttribute('modifier', 'chevron longdivider');
        }
        item.innerHTML =
            `<div class="left">
               <img class="list-item__icon list-icon" src="${STATIC_URL}${WIDGET_ICON[panel_config.widget]}"/>
               </div>
             <div class="center">
                ${panel_config.title}
             </div>
             <div class="right">
               <span class="item-delete">
                 <ons-icon icon="ion-ios-trash, material:ion-android-delete" size="18px, material:lg">
                 </ons-icon></span>
             </div>`;

        /*
        let edit = document.createElement('span');
        edit.classList.add('edit');
        edit.addEventListener('click', function() {
            display_config(panel_number);
        });
        edit.innerHTML = '[edit]';

        let del = document.createElement('span');
        del.classList.add('del');
        del.addEventListener('click', function() {
            PANELS.splice(panel_number, 1);
            STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
            populate_panel_list();
        });
        del.innerHTML = '[delete]';
        */
        list.appendChild(item);
    }

}

function choose_new_panel() {
    ons.openActionSheet({
        title: 'Choose new panel',
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
        let navigator = document.querySelector('#myNavigator');
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

// Find the position of a node within its containing element
function getElementIndex(node) {
    var index = 0;
    while ( (node = node.previousElementSibling) ) {
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

