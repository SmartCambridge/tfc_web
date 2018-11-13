/* jshint esversion: 6 */

let PANELS = [];

const TCS_VERSION = 1;

const STORAGE = window.localStorage;

const PAGES = {

    first: {
        el: document.querySelector('.first'),
        init: function(page_element) {
            let button = page_element.querySelector('.accept');
            button.addEventListener('click', function(evt) {
                STORAGE.setItem('TCS_VERSION', TCS_VERSION);
                show_page('panels');
            });
        }
    },

    panels: {
        el: document.querySelector('.panels'),
        init: function(page_element) {
            let add = page_element.querySelector('.new');
            add.addEventListener('click', function(evt) {
                display_config();
            });
        }
    },

    panel: {
        el: document.querySelector('.panel'),
        init: function(page_element) {
            let back = page_element.querySelector('.back');
            back.addEventListener('click', function(evt) {
                show_page('panels');
            });
            let forward = page_element.querySelector('.forward');
            forward.addEventListener('click', function(evt) {
               show_page('panel_overlay');
            });
        }
    },

    panel_overlay: {
        el: document.querySelector('.panel-overlay'),
        init: function(page_element) {
            let back = page_element.querySelector('.back');
            back.addEventListener('click', function(evt) {
               show_page('panel');
            });
        }
    },

    config: {
        el: document.querySelector('.config'),
        init: function(page_element) {
            let save = page_element.querySelector('.save');
            save.addEventListener('click', function(evt) {
                el = page_element.querySelector('.data');
                if (el.panel_id === '') {
                    PANELS.push(JSON.parse(el.value));
                    STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                }
                else {
                    PANELS[el.panel_id] = JSON.parse(el.value);
                    STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                }
                populate_panel_list();
                show_page('panels');
            });
            let cancel = page_element.querySelector('.cancel');
            cancel.addEventListener('click', function(evt) {
                show_page('panels');
            });
            let forward = page_element.querySelector('.forward');
            forward.addEventListener('click', function(evt) {
               show_page('config_overlay');
            });
        }
    },

    config_overlay: {
        el: document.querySelector('.config-overlay'),
        init: function(page_element) {
            let back = page_element.querySelector('.back');
            back.addEventListener('click', function(evt) {
                show_page('config');
            });
        }
    }
};

function startup() {

    // Initialise every page
    for (let page_name in PAGES) {
        if (PAGES.hasOwnProperty(page_name)) {
            page = PAGES[page_name];
            if (page.hasOwnProperty('init')) {
                    page.init(page.el);
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

// Show the page 'page' if defined and hide all the others
function show_page(page_name) {

    // show this page  (if defined
    if (page_name && PAGES.hasOwnProperty(page_name)) {
        let page = PAGES[page_name];
        if (page.hasOwnProperty('show')) {
            page.show(page.el);
        }
        page.el.hidden = false;
    }

    // ...and hide all the others
    for (let other_page_name in PAGES) {
        if (PAGES.hasOwnProperty(other_page_name)) {
            if (!page_name || page_name != other_page_name) {
                let page = PAGES[other_page_name];
                page.el.hidden = true;
                if (page.hasOwnProperty('hide')) {
                    page.hide(page.el);
                }
            }
        }

    }

}

// Display panel identified by 'panel_no'
function display_panel(panel_no) {
    el = PAGES.panel.el;
    panel_title = el.querySelector('.title');
    panel_title.textContent = PANELS[panel_no].title;
    show_page('panel');
}


// Update the list on the 'pannels' page with the current panels
function populate_panel_list() {
    let page_element = PAGES.panels.el;
    let list = page_element.querySelector('.list');
    while (list.firstChild) {
        list.removeChild(list.firstChild);
    }
    for (let i = 0; i < PANELS.length; i++) {
        let text = document.createElement('span');
        (function(i) {
            text.addEventListener('click', function() {
                display_panel(i);
            });
        })(i);
        text.innerHTML = PANELS[i].title;
        let edit = document.createElement('span');
        (function(i) {
            edit.addEventListener('click', function() {
                display_config(i);
            });
        })(i);
        edit.innerHTML = 'Edit';
        let del = document.createElement('span');
        (function(i) {
            del.addEventListener('click', function() {
                PANELS.splice(i,1);
                STORAGE.setItem('MOBILE_PANELS', JSON.stringify(PANELS));
                populate_panel_list();
            });
        })(i);
        del.innerHTML = 'Delete';
        let li = document.createElement('li');
        li.appendChild(text);
        li.appendChild(edit);
        li.appendChild(del);
        list.appendChild(li);
    }

}

// Show a widget config populated by config (if provided)
function display_config(config) {
    let data_el = PAGES.config.el.querySelector('.data');
    if (config !== undefined ) {
        data_el.value = JSON.stringify(PANELS[config], null, 2);
        data_el.panel_id = config;
    }
    else {
        data_el.value = '';
        data_el.panel_id = '';
    }
    show_page('config');
}


// Let it run
startup();
