'use strict';

let PANELS = [];

const TCS_VERSION = 1;

const STORAGE = window.localStorage;

/*

This object defines and configures all the pages in the application.
Each property represents a page. Each property value is is further object.
These 'page objects' have the following properties:

  el: The DOM object into which the page is drawn
  init: (optional) If present, an object method that is called once at
    startup to set up the page
  show: (optional) If present, an object method that is called before
    displaying the page
  hide: (optional) If present, an object method that is called before
    hiding the page

*/

const PAGES = {

    // Splash page displayed to new users of the appp
    first: {
        el: document.querySelector('.first'),
        init: function() {
            let button = this.el.querySelector('.accept');
            button.addEventListener('click', function() {
                STORAGE.setItem('TCS_VERSION', TCS_VERSION);
                show_page('panels');
            });
        }
    },

    // Main index page, displaying all configured panels
    panels: {
        el: document.querySelector('.panels'),
        init: function() {
            let add = this.el.querySelector('.new');
            add.addEventListener('click', function() {
                display_config();
            });
        }
    },

    // Panel display page
    panel: {
        el: document.querySelector('.panel'),
        init: function() {
            let back = this.el.querySelector('.back');
            back.addEventListener('click', function() {
                show_page('panels');
            });
            let forward = this.el.querySelector('.forward');
            forward.addEventListener('click', function() {
                show_page('panel_overlay');
            });
        }
    },

    // Additional panel display page (e.g. for a map sowing the stop
    // corresponding to a particular timetable)
    panel_overlay: {
        el: document.querySelector('.panel-overlay'),
        init: function() {
            let back = this.el.querySelector('.back');
            back.addEventListener('click', function() {
                show_page('panel');
            });
        }
    },

    // Panel config age
    config: {
        el: document.querySelector('.config'),
        init: function() {
            let page_element = this.el;
            let save = page_element.querySelector('.save');
            save.addEventListener('click', function() {
                let data_element = page_element.querySelector('.data');
                let panel_id = data_element.dataset.panel_id;
                // New panel (note panel_id can be 0 and hence false...)
                if (panel_id === null) {
                    PANELS.push(JSON.parse(data_element.value));
                    STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                }
                // Edited existing panel
                else {
                    PANELS[panel_id] = JSON.parse(data_element.value);
                    STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                }
                // Re-populate the list of available panels
                populate_panel_list();
                show_page('panels');
            });
            let cancel = page_element.querySelector('.cancel');
            cancel.addEventListener('click', function() {
                show_page('panels');
            });
            let forward = page_element.querySelector('.forward');
            forward.addEventListener('click', function() {
                show_page('config_overlay');
            });
        }
    },

    // Additional config page (e.g. for displaying a stop selector  map)
    config_overlay: {
        el: document.querySelector('.config-overlay'),
        init: function() {
            let back = this.el.querySelector('.back');
            back.addEventListener('click', function() {
                show_page('config');
            });
        }
    }
};

// Startup the application
function startup() {

    // Initialise every page
    for (let page_name in PAGES) {
        if (PAGES.hasOwnProperty(page_name)) {
            let page = PAGES[page_name];
            if (page.hasOwnProperty('init')) {
                page.init();
            }
        }

    }

    // Retrieve the configuration
    if (STORAGE.getItem('MOBILE_PANELS')) {
        PANELS = JSON.parse(STORAGE.getItem('MOBILE_PANELS'));
        populate_panel_list();
    }

    // Opening page depends in STORAGE.TCS_VERSION
    if (STORAGE.getItem('TCS_VERSION') >= TCS_VERSION) {
        show_page('panels');
    }
    else {
        show_page('first');
    }

}

// Show the page named 'page_pane' if defined and hide all the others
function show_page(page_name) {

    // show this page  (if defined)
    if (page_name && PAGES.hasOwnProperty(page_name)) {
        let page = PAGES[page_name];
        if (page.hasOwnProperty('show')) {
            page.show();
        }
        page.el.hidden = false;
    }

    // ...and hide all the others
    for (let other_page_name in PAGES) {
        if (PAGES.hasOwnProperty(other_page_name)) {
            if (!page_name || page_name !== other_page_name) {
                let other_page = PAGES[other_page_name];
                other_page.el.hidden = true;
                if (other_page.hasOwnProperty('hide')) {
                    other_page.hide();
                }
            }
        }

    }

}

// Update the list on the 'pannels' page with the current panels
function populate_panel_list() {
    let list = PAGES.panels.el.querySelector('.list');

    // Remove existing entries
    while (list.firstChild) {
        list.removeChild(list.firstChild);
    }

    // Populate
    for (let i = 0; i < PANELS.length; i++) {
        let panel_number = i;

        let text = document.createElement('span');
        text.addEventListener('click', function() {
            display_panel(panel_number);
        });
        text.innerHTML = PANELS[panel_number].title + ' ';

        let edit = document.createElement('span');
        edit.addEventListener('click', function() {
            display_config(panel_number);
        });
        edit.innerHTML = '[edit] ';

        let del = document.createElement('span');
        del.addEventListener('click', function() {
            PANELS.splice(panel_number, 1);
            STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
            populate_panel_list();
        });
        del.innerHTML = '[delete]';

        let li = document.createElement('li');
        li.appendChild(text);
        li.appendChild(edit);
        li.appendChild(del);
        list.appendChild(li);
    }

}

// Display panel identified by 'panel_no'
function display_panel(panel_no) {
    let el = PAGES.panel.el;
    let panel_title = el.querySelector('.title');
    panel_title.textContent = PANELS[panel_no].title;
    show_page('panel');
}

// Show a widget config populated by config (if provided)
function display_config(panel_no) {
    let data_el = PAGES.config.el.querySelector('.data');
    if (panel_no !== undefined ) {
        data_el.value = JSON.stringify(PANELS[panel_no], null, 2);
        data_el.dataset.panel_id = panel_no;
    }
    else {
        data_el.value = '';
        data_el.dataset.panel_id = null;
    }
    show_page('config');
}


// Let it run
startup();
