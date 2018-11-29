/* globals ons, Weather, StationBoard, StopTimetable, StopBusMap, WIDGET_CONFIG, RTMonitorAPI */

'use strict';

var RTMONITOR_API;

const TCS_VERSION = 1;

const STORAGE = window.localStorage;

let PANELS = [];
let current_widget;

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
        page.querySelector('#add').addEventListener('click', function() {
            document.querySelector('#myNavigator').pushPage('config.html', {data: { panel_number: null }});
        });
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
        let config_el = page.querySelector('#config-data');
        let panel_number = page.data.panel_number;
        if (panel_number !== null) {
            config_el.value = JSON.stringify(PANELS[panel_number], null, 2);
        }
        else {
            config_el.value = '';
        }
        page.querySelector('#submit').addEventListener('click', function() {
            // New panel (note panel_id can be 0 and hence false...)
            if (panel_number === null) {
                PANELS.push(JSON.parse(config_el.value));
                STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
            }
            // Edited existing panel
            else {
                PANELS[panel_number] = JSON.parse(config_el.value);
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
                                            rt_token: '888'

        });
        break;
    }

    current_widget.display(
        {
            container_id: 'widget-' + widget_type,
            static_url: `/static_web/smartpanel/widgets/${panel_config.widget}/`,
            display_id: '', layout_id: '',
            rt_token: '778',
            layout_name: 'Layouts for mobile',
            display_name: '', layout_owner: '',
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
            'zoom': 13,
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

    let map_widget = new StopBusMap('4');
    map_widget.display(
        {
            container_id: 'widget-stop_bus_map',
            static_url: `/static_web/smartpanel/widgets/stop_bus_map/`,
            display_id: '', layout_id: '',
            rt_token: '778',
            layout_name: 'Layouts for mobile',
            display_name: '', layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        map_config
    );
}

const WIDGET_ICON_URL = {
    'weather': '/static_web/smartpanel/widgets/weather/weather.png',
    'station_board': '/static_web/smartpanel/widgets/station_board/br-logo.png',
    'stop_timetable': '/static_web/smartpanel/widgets/stop_timetable/bus.png',
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
               <img class="list-item__icon list-icon" src="${WIDGET_ICON_URL[panel_config.widget]}"/>
               </div>
             <div class="center">
                ${panel_config.title}
             </div>
             <div class="right">
               <span class="item-delete">
                 <ons-icon icon="ion-ios-trash, material:ion-android-delete" size="24px, material:lg">
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

