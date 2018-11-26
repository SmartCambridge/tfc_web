/* globals ons, Weather, StationBoard, StopTimetable */

'use strict';

const TCS_VERSION = 1;

const STORAGE = window.localStorage;

let PANELS = [];

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
    var page = event.target;

    console.log(`Running init for ${page.id}`);

    if (page.id === 'first') {
        page.querySelector('#accept').addEventListener('click', function() {
            STORAGE.setItem('TCS_VERSION', TCS_VERSION.toString());
            document.querySelector('#myNavigator').pushPage('panels.html');
        });
    }

    else if (page.id === 'panels') {
        page.querySelector('#add').addEventListener('click', function() {
            document.querySelector('#myNavigator').pushPage('config.html');
        });
        // TODO - remove
        page.querySelector('#panel-items').addEventListener('click', function(evt) {
            let list_item = evt.target.closest('ons-list-item');
            if (!list_item) {
                return;
            }
            let panel_number = getElementIndex(list_item);
            document.querySelector('#myNavigator').pushPage('panel.html', { data: { panel_number }});
        });
        populate_panel_list();
    }

    else if (page.id === 'panel') {
        page.querySelector('#map').addEventListener('click', function() {
            document.querySelector('#myNavigator').pushPage('panel-overlay.html');
        });
        console.log(page.data);
        display_panel(page);
    }

    else if (page.id === 'config') {
        page.querySelector('#submit').addEventListener('click', function() {
            document.querySelector('#myNavigator').popPage();
        });
        page.querySelector('#cancel').addEventListener('click', function() {
            document.querySelector('#myNavigator').popPage();
        });
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

    let widget = null;
    switch (widget_type) {
    case 'weather':
        widget = new Weather('0');
        page.querySelector('.forward').hidden = true;
        break;
    case 'station_board':
        widget = new StationBoard('0');
        page.querySelector('.forward').hiddden = true;
        break;
    case 'stop_timetable':
        widget = new StopTimetable('0');
        page.querySelector('.forward').hidden = false;
        break;
    }

    widget.display(
        {
            container_id: 'widget-' + widget_type,
            static_url: `/static_web/smartpanel/widgets/${panel_config.widget}/`,
            display_id: '',
            layout_id: '',
            rt_token: '778',
            layout_name: 'Layouts for mobile',
            display_name: '',
            layout_owner: '',
            display_owner: '',
            settings: WIDGET_CONFIG
        },
        panel_config.data
    );
    //RTMONITOR_API.init();
}



function clear_element(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

// Update the list on the 'pannels' page with the current panels
function populate_panel_list() {
    let list = document.querySelector('#panel-items');

    // Remove existing entries
    clear_element(list);

    // Populate
    for (let panel_number = 0; panel_number < PANELS.length; panel_number++) {
        let panel_config = PANELS[panel_number];

        let item = document.createElement('ons-list-item');
        item.setAttribute('modifier', 'chevron longdivider');
        item.setAttribute('tappable', '');
        item.innerHTML = `[ICON] ${panel_config.title}`;

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

