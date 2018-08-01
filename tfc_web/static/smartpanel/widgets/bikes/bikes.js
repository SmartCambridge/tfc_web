/* Bikes Map Widget for ACP Lobby Screen */

// Draws location of shared bikes in a map.
// used in smartpanels with:
//      new Bikes(<layout config object>, <widget params object>)
//
//      params are
//                       map.lat: 52.215,
//                       map.lng: 0.09,
//                       map.zoom: 16,
//

function Bikes(widget_id) {
    'use strict';

    var DEBUG = ' bikes_map_log';

    var self = this;
    self.widget_id = widget_id;
    var bikes = {
        'ofo': [],
        'mobike': []
    };
    var icons;
    var map;
    var map_tiles;

    var url;

    var SECONDS = 1000; // '000 milliseconds for setTimeout/setInterval

    var OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var OSM_MAX_ZOOM = 19;
    var OSM_ATTRIBUTION = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> ' +
    'contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a></a>';

    this.display = function(config, params) {
        self.config = config;
        self.params = params;

        url = "/smartpanel/widgets/bikes?lat=" + self.params.map.lat + "&lng=" + self.params.map.lng;

        var container_el = document.getElementById(self.config.container_id);
        // Empty the 'container' div (i.e. remove loading GIF)
        while (container_el.firstChild) {
                container_el.removeChild(container_el.firstChild);
        }

        icons = {
            'ofo': L.icon({iconUrl: self.config.static_url+'images/ofo.png', iconSize: [38, 41]}),
            'mobike': L.icon({iconUrl: self.config.static_url+'images/mobike_red.png', iconSize: [36, 41]}),
        };

        // Set up title of the map
        var title_h1 = document.createElement('h1');
        title_h1.setAttribute('class', 'bikes_map_title_h1');
        title_h1.setAttribute('id', self.config.container_id+'_title_h1');
        title_h1.appendChild(document.createTextNode('🚲 ' + self.params.title));
        container_el.appendChild(title_h1);

        // Set up legend of the map
        var subtitle = document.createElement('p');
        subtitle.setAttribute('class', 'bikes_map_subtitle');
        subtitle.setAttribute('id', self.config.container_id+'_subtitle');
        var mobike_img = document.createElement('img');
        mobike_img.setAttribute('src', self.config.static_url+'images/mobike_red.png');
        mobike_img.setAttribute('id', 'mobike_legend_icon');
        subtitle.appendChild(mobike_img);
        subtitle.appendChild(document.createTextNode('mobike'));
        var ofo_img = document.createElement('img');
        ofo_img.setAttribute('src', self.config.static_url+'images/ofo.png');
        ofo_img.setAttribute('id', 'ofo_legend_icon');
        subtitle.appendChild(ofo_img);
        subtitle.appendChild(document.createTextNode('ofo'));
        container_el.appendChild(subtitle);

        // Set up map
        var map_div = document.createElement('div');
        map_div.setAttribute('class','bikes_map_div');
        map_div.setAttribute('id', self.config.container_id+'_map');
        container_el.appendChild(map_div);

        // Initialise map
        map = L.map(map_div, { zoomControl:false }).setView(
            [self.params.map.lat, self.params.map.lng], self.params.map.zoom);
        map_tiles = L.tileLayer(OSM_TILES, { attribution: OSM_ATTRIBUTION, maxZoom: OSM_MAX_ZOOM }).addTo(map);

        this.do_load();
    };

    this.do_load = function () {
        this.log(self.widget_id, "Running StationBoard.do_load");
        this.log(self.widget_id, "do_load URI", url);
        // Load bikes list location from APIs using ajax
        $.ajax({
            type: "GET",
            url: url,
            success: self.update_bikes,
            error: function () {
                self.log(self.widget_id, "Error loading bikes from API");
            }
        });
        setTimeout(function () { self.do_load(); }, 900 * SECONDS); // reload bikes locations every 15 minutes
        this.log(self.widget_id, "do_load done");
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('bikes_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.update_bikes = function (data) {
        self.log(self.widget_id, data);
        var old_bikes = Object.assign([], bikes);
        bikes = {
            'ofo': [],
            'mobike': []
        };

        // OFO BIKES
        for (var i in data['ofo']['values']['cars']) {
            self.log(self.widget_id, data['ofo']['values']['cars'][i]);

            var bike = data['ofo']['values']['cars'][i];
            var existing_bike_index = old_bikes['ofo'].findIndex(b => b['carno'] === bike['carno']);
            if (existing_bike_index > -1){
                // Bike with carno already in the existing bikes list no need to create new marker
                bike['marker'] = old_bikes['ofo'][existing_bike_index]['marker'];
                old_bikes['ofo'].splice(existing_bike_index, 1); // remove old entry
                bikes['ofo'].push(bike); // put new entry
            } else {
                // bike didn't exist in the map before so create a new marker for the bike
                bike['marker'] = L.marker([ bike["lat"], bike["lng"] ], { icon: icons['ofo'] }).addTo(map);
                bikes['ofo'].push(bike); // put new entry
            }
        }
        // Remove old ofo bikes that no longer appear
        for (var i in old_bikes['ofo']) {
            map.removeLayer(old_bikes['ofo'][i]['marker']);
        }

        // MOBIKE BIKES
        for (var i in data['mobike']['object']) {
            self.log(self.widget_id, data['mobike']['object'][i]);

            var bike = data['mobike']['object'][i];
            var existing_bike_index = old_bikes['mobike'].findIndex(b => b['bikeIds'] === bike['bikeIds']);
            if (existing_bike_index > -1){
                // Bike with bikeIds already in the existing bikes list no need to create new marker
                bike['marker'] = old_bikes['mobike'][existing_bike_index]['marker'];
                old_bikes['mobike'].splice(existing_bike_index, 1); // remove old entry
                bikes['mobike'].push(bike); // put new entry
            } else {
                // bike didn't exist in the map before so create a new marker for the bike
                bike['marker'] = L.marker([ bike["distY"], bike["distX"] ], { icon: icons['mobike'] }).addTo(map);
                bikes['mobike'].push(bike); // put new entry
            }
        }
        // Remove old mobike bikes that no longer appear
        for (var i in old_bikes['mobike']) {
            map.removeLayer(old_bikes['mobike'][i]['marker']);
        }
    };

    // ************************************************************************************
    // *****************  Widget Configuration ********************************************
    // ************************************************************************************
    this.configure = function (config, params) {

        var CONFIG_TITLE = 'Configure Bikes Map';

        self.log(self.widget_id, 'Bikes Map configuring widget with', config.container_id, params);

        var widget_config = new WidgetConfig(config);

        self.log('Bikes Map configuring widget with', config, params);

        var config_div = document.getElementById(config.container_id);

        // Empty the 'container' div (i.e. remove loading GIF or prior content)
        while (config_div.firstChild) {
            config_div.removeChild(config_div.firstChild);
        }

        config_div.style.display = 'block';

        // Create HTML for configuration form
        var title = document.createElement('h1');
        title.innerHTML = CONFIG_TITLE;

        config_div.appendChild(title);

        var config_form = document.createElement('form');

        config_div.appendChild(config_form);

        var input_result = input_bikes_map(widget_config, config_form, params);

        return input_result;
    }; // end this.configure()

    // Input the BikesMap parameters
    // input_bikes_map: draw an input form (as a table) of the required inputs
    //   widget_config: an instantiated object from widget-config.js providing .input and .choose
    //   parent_el: the DOM element this input form will be added to
    //   params: the existing parameters of the widget
    function input_bikes_map(widget_config, parent_el, params) {

        self.log('input_bikes_map with', params);

        // Add some guide text
        var config_info1 = document.createElement('p');
        var config_info_text = "This widget displays a map, it's location will be used to retrieve shared bikes " +
            "(from ofo and mobike) located nearby which will be shown to users";
        config_info_text += " 'Main Title' is any text to appear in bold at the top of the map.";
        config_info1.appendChild(document.createTextNode(config_info_text));
        parent_el.appendChild(config_info1);

        var config_table = document.createElement('table');
        config_table.className = 'config_input_stop_timetable';
        parent_el.appendChild(config_table);

        var config_tbody = document.createElement('tbody');
        config_table.appendChild(config_tbody);

        // Each config_input(...) will return a .value() callback function for the input data

        // TITLE
        var title_result = widget_config.input(config_tbody, 'string',
            { text: 'Main Title:', title: 'The main title at the top of the widget, e.g. bus stop name' },
            params.title);

        // MAP
        self.log('configure() calling widget_config.input', 'with', params.map);
        var bikes_map_result = widget_config.input(config_tbody, 'leaflet_map',
            { text: 'Map:', title: "Click select map view" },
            { map: params.map });

        // value() is the function for this input element that returns its value
        var value_fn = function () {
            var config_params = {};
            // title
            config_params.title = title_result.value();

            // map
            config_params.map = bikes_map_result.value().map;

            self.log(self.widget_id, 'input_bikes_map returning params:', config_params);

            return config_params;
        };

        var config_fn = function () {
            return { title: title_result.value() };
        };

        return { valid: function () { return true; }, //debug - still to be implemented,
                 config: config_fn,
                 value: value_fn };

    } // end input_bikes_map)

// END of 'class' Bikes
}
