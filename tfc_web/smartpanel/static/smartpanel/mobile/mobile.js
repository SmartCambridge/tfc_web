/* jshint esversion: 6 */

const PAGES = [ 'first', 'panels', 'panel', 'panel-overlay', 'config', 'config-overlay'];

const panels = [ 'Panel 1', 'Panel 2', 'Panel 3' ];

const TCS_VERSION = 1;

const localStorage = window.localStorage;

/* First page */

let first_page = document.querySelector('.first');
let acceptButton = first_page.querySelector('.accept');
acceptButton.addEventListener('click', tcs_accept);

function tcs_accept(evt) {
    localStorage.setItem('TCS_VERSION', TCS_VERSION);
    show_page('panels');
}

/* my-items page */

let panels_page = document.querySelector('.panels');
let panel_list = panels_page.querySelector('.list');

for (let i = 0; i < panels.length; i++) {
    let li = document.createElement('li');
    let text = document.createTextNode(panels[i]);
    li.appendChild(text);
    li.addEventListener('click', display_panel);
    panel_list.appendChild(li);
}

function display_panel(evt) {
    panel_title.textContent = evt.currentTarget.textContent;
    show_page('panel');
}

/* panel */

let panel_page = document.querySelector('.panel');
let panel_title = panel_page.querySelector('.title');
let panel_back = panel_page.querySelector('.back');
panel_back.addEventListener('click', panel_go_back);
let panel_forward = panel_page.querySelector('.forward');
panel_forward.addEventListener('click', panel_go_forward);

function panel_go_back(evt) {
    show_page('panels');
}

function panel_go_forward(evt) {
    show_page('panel-overlay');
}

/* panel overlay */

let panel_overlay_page = document.querySelector('.panel-overlay');
let panel_overlay_back = panel_overlay_page.querySelector('.back');
panel_overlay_back.addEventListener('click', panel_overlay_go_back);

function panel_overlay_go_back(evt) {
    show_page('panel');
}




/* Show the page with class 'page' and hide all the others */
function show_page(page) {

    if (page) {
        let element = document.querySelector('.' + page);
        element.hidden = false;
    }

    for (let i = 0; i < PAGES.length; i++) {
        if (!page || page != PAGES[i]) {
            let element = document.querySelector('.' + PAGES[i]);
            element.hidden = true;
        }
    }

}



if (localStorage.getItem('TCS_VERSION') >= TCS_VERSION) {
    show_page('panels');
}
else {
    show_page('first');
}