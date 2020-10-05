"use strict";
class VoronoiViz {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        this.svg_canvas = null;

        this.site_db = new SiteDB();

        this.hud = new Hud();

        this.tools = new VizTools();

        //object globals
        this.map;
        this.clock;
        this.topLeft;
        this.links_drawn = [];
        this.boundary_db = [];
        this.boundary_points = [];

        //svg groups
        this.polygon_group;
        this.dijkstra_group;
        this.zone_outlines;

        //color range picker
        this.set_color;
        
        // initialises the map on screen
        this.init_map(this);
    }

    // init() called when page loaded
    init() {
        console.log('STARTING')

        var voronoi_viz = this;

        //-------------------------------//
        //--------LOADING API DATA-------//
        //-------------------------------//

        voronoi_viz.site_db.load_api_data(voronoi_viz).then(() => {

            voronoi_viz.site_db.initialise_nodes(voronoi_viz);

            voronoi_viz.hud.init(voronoi_viz, URL_NODE);

            voronoi_viz.draw_voronoi(voronoi_viz);
            voronoi_viz.generate_hull(voronoi_viz);

        });

        //attach map event listeners
        voronoi_viz.map.on("viewreset moveend", voronoi_viz.draw_voronoi.bind(voronoi_viz));
        voronoi_viz.map.on("viewreset moveend", voronoi_viz.generate_hull.bind(voronoi_viz));

        //Will execute myCallback every X seconds 
        //the use of .bind(this) is critical otherwise we can't call other class methods
        //https://stackoverflow.com/questions/42238984/uncaught-typeerror-this-method-is-not-a-function-node-js-class-export
        window.setInterval(voronoi_viz.update.bind(voronoi_viz), 60000);
    }

    update() {
        var voronoi_viz = this;
        console.log('UPDATING')

        voronoi_viz.site_db.load_api_data(voronoi_viz).then(() => {

            voronoi_viz.site_db.update_nodes(voronoi_viz);
            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            voronoi_viz.hud.show_vertical_bar(voronoi_viz, voronoi_viz.site_db.get_zone_averages(voronoi_viz));

            console.log('redraw voronoi')
            voronoi_viz.draw_voronoi(voronoi_viz);

            console.log('reloaded api data');
        });

        voronoi_viz.clock.update(Date.now());
    }

    //parses the URL date, updates the date bar in the middle of the page (top)
    //and returns the formatted date to be passed to other functions
    get_url_date() {
        let date, month_long;

        //if no date provided, set the date as 'today'
        if (URL_DATE == '*') {
            date = new Date()
            month_long = date.toLocaleString('default', {
                month: 'long'
            });
        } else {
            let split_date = URL_DATE.split('-')

            let months = [];

            //use moment.js for the date conversion from '9' or '09' to September
            months.push(moment().month(split_date[1] - 1).format("MMMM"));

            //make a string again to keep new Date() happy
            let date_string = split_date[0].toString() + ' ' + months[0].toString() + ' ' + split_date[2].toString();

            date = new Date(date_string)
            month_long = date.toLocaleString('default', {
                month: 'long'
            });
        }

        //get date values to be returned/added on the top-middle div
        let year = date.getFullYear();
        let month_short = ("0" + (date.getMonth() + 1)).slice(-2);
        let day = ("0" + (date.getDate())).slice(-2)

        //update the innerHTML
        document.getElementById('date_now').innerHTML = "<h2 id='date_now_header'>" + day + " " +
            month_long + " " + year + "</h2>";

        return year + "-" + month_short + "-" + day;
    }

    get_selected_date(voronoi_viz) {
        let new_date = new Date(document.getElementById('date_now_header').innerHTML); // as loaded in page template config_ values;

        let new_year = new_date.getFullYear();
        let new_day = ("0" + new_date.getDate()).slice(-2);
        let new_month = ("0" + (new_date.getMonth() + 1)).slice(-2);
        let new_month_long = new_date.toLocaleString('default', {
            month: 'long'
        });

        return new_year + "-" + new_month + "-" + new_day;
    }

    draw_voronoi(voronoi_viz) {

        //on 'moveend' redeclare the voronoi_viz, otherwise the visualisaiton fails to load
        //since the 'this' becomes the 'moveend' object
        if (voronoi_viz.type == "moveend") {
            voronoi_viz = this;
        }

        //remove old cell overlay and prepare to draw a new one
        d3.select('#cell_overlay').remove();

        // Reset the clock
        voronoi_viz.clock.update();

        //create a variable for the dbclick functionality
        ///that finds the shortest path between two selected cites
        let selected_sites = [];

        //create map bounds to know where to stop drawing
        //as well topLeft && bottomRight values  
        let bounds = voronoi_viz.map.getBounds(),
            bottomRight = voronoi_viz.map.latLngToLayerPoint(bounds.getSouthEast()),
            drawLimit = bounds.pad(0.4);

        //topLeft is a global since it's used outside the scope to position
        //other objects in relation to the Voronoi diagram
        voronoi_viz.topLeft = voronoi_viz.map.latLngToLayerPoint(bounds.getNorthWest());

        /*
         Lat/Lng to pixel conversion
         
         Here we use all_sites(Bluetooth sensor sites) and boundary_sites(imaginary sites that close off the Voronoi diagram)
         Naming conventions: "sites" is refering to physical lat/lng location, whereas "points" are pixel values on screen,
         hence the creation of variables like boundary_sites and voronoi_viz.boundary_points. 
    
         */


        //we filter out sites from all_sites that are within our drawing box
        //e.g. when zoomed in, not all sites get drawn since they appear out of the screen
        var filtered_points = [];

        //filtered points are voronoi center points - bluetooth sensor locations
        filtered_points = voronoi_viz.site_db.all_sites.filter(function (d, i) {
            let latlng = new L.latLng(d.location.lat, d.location.lng);

            //make sure not drawing out of bounds
            if (!drawLimit.contains(latlng)) {
                return false
            };

            let point = voronoi_viz.map.latLngToLayerPoint(latlng);

            //set coordinates values in all_sites for further use
            d.x = point.x;
            d.y = point.y;

            //set coordinates values in SITE_DB for further use
            voronoi_viz.site_db.all[i].x = point.x;
            voronoi_viz.site_db.all[i].y = point.y;

            return true;
        });

        //voronoi_viz.boundary_points are voronoi center points that limit the perimeter of the visible cells.
        //We created a list of invisible cells so that the Voronoi diagram does not triangulate
        //itself to inifinity. The coordinates for these can be found in boundary_sites.js
        voronoi_viz.boundary_points = boundary_sites.filter(function (d, i) {
            let latlng = new L.latLng(d.lat, d.lng);
            if (!drawLimit.contains(latlng)) {
                return false
            };

            let point = voronoi_viz.map.latLngToLayerPoint(latlng);

            //set coordinates values in boundary_sites for further use
            d.x = point.x;
            d.y = point.y;

            //set coordinates values in BOUNDARY_DB for further reuse
            voronoi_viz.boundary_db.push({
                "lat": d.lat,
                "lng": d.lng,
                "x": point.x,
                "y": point.y
            });
            return true;
        });

        //create color a range to be able to color in cells based on their values
        voronoi_viz.set_color = voronoi_viz.set_color_range(voronoi_viz);

        //findLatLng(); //optional function, provides lat/lng coordinates if clicked on the map

        /*
        Creating the voronoi triangulation, using the previously defined boundaries
    
        This is integral to the visualisation, and d3.js provides some very nice
        functions that do all the work for us.
        */

        let voronoi = d3.voronoi()
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            })
            .extent([
                [voronoi_viz.topLeft.x, voronoi_viz.topLeft.y],
                [bottomRight.x, bottomRight.y]
            ]);


        //the lines below might be a bit counterintuitive, but we have to create both
        //visible and invisible polygons at once to ensure even triangulation.

        //combine boundary(invisible) nodes with the actual sensor node to make polygons
        //that are evenly triangulated
        for (let i = 0; i < voronoi_viz.boundary_points.length; i++) {
            filtered_points.push(voronoi_viz.boundary_points[i]);
        }

        //create voronoi polygons from all the nodes.
        //this wouldn't work if we did voronoi.polygons(voronoi_viz.boundary_points)
        //and voronoi.polygons(filtered_points) separately
        let voronoi_polygons = voronoi.polygons(filtered_points);

        //list containing all visible polygons. Here we separate
        //filetered_points from voronoi_viz.boundary_points again
        let ready_voronoi_polygons = [];

        //invisible polygons are undefined so we ignore them
        for (let i = 0; i < voronoi_polygons.length; ++i) {
            if (voronoi_polygons[i] !== undefined) {
                ready_voronoi_polygons.push(voronoi_polygons[i]);
            }
        }

        //appending the d3.js SVG to the map.
        //the svg_canvas variable will also contain all of the d3.generated proto objects
        //like lines, outlines and the polygons (voronoi cells).
        voronoi_viz.svg_canvas = d3.select(voronoi_viz.map.getPanes().overlayPane).append("svg")
            .attr("id", "cell_overlay")
            .attr("class", "leaflet-zoom-hide")
            .style("width", voronoi_viz.map.getSize().x + "px")
            .style("height", voronoi_viz.map.getSize().y + "px")
            .style("margin-left", voronoi_viz.topLeft.x + "px")
            .style("margin-top", voronoi_viz.topLeft.y + "px");

        //append voronoi polygons to the canvas
        voronoi_viz.polygon_group = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");

        //append zone outlines to the canvas
        voronoi_viz.zone_outlines = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");

        //append drawn links to the canvas
        voronoi_viz.link_group = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");

        //append dijkstra shortest path generated line to the canvas
        voronoi_viz.dijkstra_group = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");

        //append circles that illustrate sensors and polygons centers to the canvas.
        //It's not a global so we just declare it here
        let circle_group = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");


        /*Drawing the Voronoi polygons on the map.
    
        The code below will have all of the d3.js shenanigans for interactivity including 
        what happens on:
    
        -mouseover (highlight cell)
        -mouseout (unhighlight cell)
        -click (selects the cell as the *selected node* and draws all the graphs)
        -doubleclick (selects cell #1 and #2 and draws the shortest path betwen them)
        
    
        Cells/Polygons are used interchangeably in the documentation, but generally speaking
        polygons are the digital representation as just the numbers in a list, whereas
        the cells are drawn objects on the screen, based on the polygon data.
        */

        //creates paths objects from the genetated polygon data 
        //(polygons are drawn as paths FYI)
        voronoi_viz.polygon_group.selectAll("g")
            .data(ready_voronoi_polygons)
            .enter()
            .append("path")
            .attr('id', (d) => d.data.acp_id)
            .attr("class", function (d, i) {
                if (d.data.description !== undefined) {
                    return "cell"
                } else {
                    return "invisibleCell"
                }
            })
            .attr("z-index", -1)
            .attr("d", function (d) {
                return "M" + d.join("L") + "Z"
            });

        //-------------------------------------//
        //----------D3.js interactivity--------//
        //---------------START-----------------//

        //add some visual properties to the drawn cells
        voronoi_viz.polygon_group.selectAll(".cell")
            .attr('fill', function (d) {

                //color the cell based on the selected reading from the SITE_DB
                //the lookup is done based on the matching id values (from SVG and in Nodes)

                let color = voronoi_viz.site_db.get_node_from_id(voronoi_viz, d.data.id).selected;

                //if undefined,set to gray
                if (color == null || color == undefined) {
                    return "rgb(50,50,50);"
                } else {
                    return voronoi_viz.set_color(color)
                }
            })

            //----------ON MOUSEOVER---------//

            .on('mouseover', function (d) {

                //highlight the cell that is being hovered on
                voronoi_viz.cell_mouseover(this);

                //get the id and the neighbors for the node that this cell represents
                let node_id = d.data.id;
                let neighbors = voronoi_viz.site_db.get_node_from_id(voronoi_viz, node_id).neighbors;

                //remove old links that were drawn for the other nodes 
                //that were hoverd in before
                d3.selectAll('.arc_line').remove()
                voronoi_viz.link_group.remove();

                //draw links for every neighbor that the node has
                for (let i = 0; i < neighbors.length; i++) {

                    let inbound = neighbors[i].links.in.id;
                    let outbound = neighbors[i].links.out.id;

                    voronoi_viz.draw_link(voronoi_viz, inbound, 350);
                    voronoi_viz.draw_link(voronoi_viz, outbound, 350);
                }
            })
            //----------ON MOUSEOUT---------//

            .on('mouseout', function () {

                //unhighlight the cell that was being hovered on
                voronoi_viz.cell_mouseout(this);

                //cleanup the links that were drawn
                voronoi_viz.links_drawn = [];
                voronoi_viz.link_group.remove();
                d3.selectAll('.arc_line').remove()

            })

            //----------ON CLICK---------//

            .on('click', function (d, i) {

                let selected_node = voronoi_viz.site_db.get_node_from_acp_id(voronoi_viz, d.data.acp_id)
                //set as the main global selection 
                voronoi_viz.site_db.set_selected_node(voronoi_viz, selected_node);

                voronoi_viz.select_cell(voronoi_viz, selected_node.node_acp_id)

                //get the selected date from the middle-top date div
                let selected_date = voronoi_viz.get_selected_date(voronoi_viz);
                voronoi_viz.hud.show_all(voronoi_viz, selected_node, selected_date);

            })

            //--------ON DOUBLE CLICK-------//

            .on("dblclick", function (d) {

                //remove old if there were any
                d3.select('#shortest_path').remove();

                //add the selected site to the list
                selected_sites.push(d.data);

                //make sure to only have a max of two sites
                if (selected_sites.length > 2) {
                    selected_sites = [];
                }

                //if the list is full, interpolate shortest path
                if (selected_sites.length === 2) {

                    //create the problem graph with start and finish nodes
                    let problem = voronoi_viz.generate_graph(voronoi_viz, selected_sites[0].name, selected_sites[1].name);

                    //run the Dijkstra shortest path on the generated graph  
                    //[returns the names of the nodes in order of the shortest path]
                    let result = dijkstra(problem, selected_sites[0].name, selected_sites[1].name);

                    //this will contain the coordinates of the nodes that the shortest path passes through
                    let path = [];

                    //fill the path variable with the shortest path data returned by the Dijkstra algorithm
                    for (let i = 0; i < result.path.length; i++) {

                        //console.log(result.path[i]);

                        let found = voronoi_viz.site_db.get_node_from_name(voronoi_viz, result.path[i]);

                        if (found.x != null || found.x != undefined) {
                            path.push({
                                "x": found.x,
                                "y": found.y
                            });;
                        }
                    }

                    //d3's line interpolator/generator
                    let line = d3.line()
                        .x(function (d, ) {
                            return d.x;
                        }) // set the x values for the line generator
                        .y(function (d) {
                            return d.y;
                        }) // set the y values for the line generator 
                        // apply smoothing to the line, I found curveCatmullRom works best
                        .curve(d3.curveCatmullRom.alpha(1)); //or d3.curveCardinal.tension(0.1)//or d3.curveNatural

                    //append the generated shortest path line to the dijkstra group on the global svg canvas
                    let shortest_path_line = voronoi_viz.dijkstra_group.append("path")
                        .attr("d", line(path))
                        .attr('id', 'shortest_path')
                        .attr("stroke", "green")
                        .attr("stroke-width", 5)
                        .attr("fill", "none");

                    //get the total length, so we can animate it
                    let total_line_length = shortest_path_line.node().getTotalLength();

                    //do the animation and make the illusion of it being drawn
                    shortest_path_line
                        .attr("stroke-dasharray", total_line_length + " " + total_line_length)
                        .attr("stroke-dashoffset", total_line_length)
                        .transition()
                        .duration(500)
                        .ease(d3.easeLinear)
                        .attr("stroke-dashoffset", 0);

                    //clear selected sites and prepare for the new selections
                    selected_sites = [];
                }

                //the double clicked cells have special dashed outlines
                //that differentiate them from the rest of the cells
                d3.select(this).attr("class", "selected");
            });

        //-------------------------------------//
        //----------D3.js interactivity--------//
        //----------------END------------------//

        //add the *title* so that the name of the node appears when the cell is being hovered on
        voronoi_viz.polygon_group.selectAll(".cell").append("title").text(function (d) {
            return d.data.name;
        });

        //add nodes' locations on the map (they're also cell/polygon centers)
        circle_group.selectAll(".point")
            .data(filtered_points)
            .enter()
            .append("circle")
            .attr("class", function (d) {
                if (d.id !== undefined) {
                    return "point"
                } else {
                    return "invisiblePoint"
                }
            })
            .attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
            .attr("r", 2.5);


        //filtered_points = [];

        //change_modes adds the option of coloring in the cells based on:
        // -current speed
        // -historical(normal) speed
        // -deviation in speed from the normal
        voronoi_viz.change_modes(voronoi_viz);

        //in case the selected node has been mislabeled:
        try {
            let node = voronoi_viz.site_db.get_selected_node(voronoi_viz).node_acp_id;
            voronoi_viz.select_cell(voronoi_viz, node);
        } catch (error) {
            console.log('no node has been selected yet, error expected:\n', error);
        }
    }

    //creates a d3 color interpolator 
    //from the min/max values of the data
    set_color_range(voronoi_viz) {

        let values = voronoi_viz.site_db.get_min_max(voronoi_viz);
        let min = values.min;
        let max = values.max;

        //create a d3 color interpolator
        return d3.scaleSequential().domain([min, max])
            .interpolator(d3.interpolateRdYlGn);
    }

    //-----------------------------------------------------//
    //-----------------END draw_voronoi()------------------//
    //-----------------------------------------------------//

    // move page to new date +n days from current date
    date_shift(n, node_id) {
        let voronoi_viz = this;

        let new_date = new Date(document.getElementById('date_now_header').innerHTML); // as loaded in page template config_ values;

        new_date.setDate(new_date.getDate() + n);

        let new_year = new_date.getFullYear();
        let new_month = ("0" + (new_date.getMonth() + 1)).slice(-2);
        let new_month_long = new_date.toLocaleString('default', {
            month: 'long'
        });

        let new_day = ("0" + new_date.getDate()).slice(-2);

        let query_date = new_year + "-" + new_month + "-" + new_day;
        document.getElementById('date_now_header').innerHTML = new_day + " " + new_month_long + " " + new_year

        voronoi_viz.hud.show_node_information(voronoi_viz, node_id, query_date);

        let url_date = new_year + '-' + new_month + '-' + new_day;
        voronoi_viz.update_url(node_id, url_date);

    }
    // ************************************************************************************
    // ************** Date forwards / backwards function **********************************
    // ************************************************************************************

    update_url(node, date) {

        //get the date for today, later to be used to check if the url needs updating
        let new_date = new Date()
        let today = ("0" + new_date.getDate()).slice(-2) + "-" + ("0" + (new_date.getMonth() + 1)).slice(-2) + "-" + new_date.getFullYear();

        //update the current date on the top of the screen (in case update_url() called not
        //from within the date_shift() function)
        let passed_date = new Date(date)

        let new_day = ("0" + passed_date.getDate()).slice(-2);
        let new_month = ("0" + (passed_date.getMonth() + 1)).slice(-2);
        let new_year = passed_date.getFullYear();
        let new_month_long = passed_date.toLocaleString('default', {
            month: 'long'
        });

        //set the header date with a long month name (September) instead of short (09)
        let header_date = new_day + "-" + new_month_long + "-" + new_year;

        //set the new date on the top
        document.getElementById('date_now_header').innerHTML = header_date;

        //used to check if the passed date is equal to 'today'
        let checker_date = new_day + "-" + new_month + "-" + new_year;

        //-----------------------------------------------//
        //-------------update the actual url-------------//
        //-----------------------------------------------//

        let searchParams = new URLSearchParams(window.location.search)

        //always set the selected node in the url
        searchParams.set("node", node);

        //if new date is different than the past, then change it 
        if (searchParams.get("date") != checker_date) {
            //but ignore the date parameter if it's 'today'
            if (today != checker_date) {
                searchParams.set("date", checker_date);
            } else {
                searchParams = searchParams.toString().split("&")[0]
            }
        }
        let newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
        window.history.pushState(null, '', newRelativePathQuery);
        console.log('updated URL', node, checker_date)
    }

    onchange_feature_select(voronoi_viz, node_id, date) {
        voronoi_viz.set_date_onclicks(voronoi_viz, node_id);

        // Change the URL in the address bar
        voronoi_viz.update_url(node_id, date);
    }

    set_date_onclicks(voronoi_viz, node_id) {
        // set up onclick calls for day/week forwards/back buttons
        document.getElementById("back_1_week").onclick = function () {
            voronoi_viz.date_shift(-7, node_id)
        };
        document.getElementById("back_1_day").onclick = function () {
            voronoi_viz.date_shift(-1, node_id)
        };
        document.getElementById("forward_1_week").onclick = function () {
            voronoi_viz.date_shift(7, node_id)
        };
        document.getElementById("forward_1_day").onclick = function () {
            voronoi_viz.date_shift(1, node_id)
        };
    }

    init_map(voronoi_viz) {

        let stamenToner = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
            attribution: 'Map tiles by Stamen Design, CC BY 3.0 - Map data © OpenStreetMap',
            subdomains: 'abcd',
            minZoom: 0,
            maxZoom: 20,
            ext: 'png'
        });
        let cambridge = new L.LatLng(52.20038, 0.1);

        voronoi_viz.map = new L.Map("map", {
            center: cambridge,
            zoom: 12,
            zoomDelta: 0.5,
            zoomSnap: 0.25,
            wheelPxPerZoomLevel: 150,
            layers: [stamenToner],
            doubleClickZoom: false,
        });

        //disable double click because it's used by Dijsktra shortest path
        voronoi_viz.map.doubleClickZoom.disable();

        // Clock
        voronoi_viz.clock = voronoi_viz.get_clock().addTo(voronoi_viz.map);

        //the order in which these elements are created is important, otherwise Leaflet becomes unhappy and creates a mess
        let line_graph_element = voronoi_viz.hud.create_element(voronoi_viz, 'line_graph', 'bottomleft');

        let datepicker_widget = voronoi_viz.hud.create_element(voronoi_viz, 'datepicker', 'bottomleft', voronoi_viz.tools.DATEPICKER_TEXT);
        document.getElementById("datepicker").style.opacity = 0; //hide it

        let metadata_element = voronoi_viz.hud.create_element(voronoi_viz, 'metadata_table', 'bottomleft');
        let selected_cell = voronoi_viz.hud.create_element(voronoi_viz, 'selected_cell', 'topright', '<h4>Select a Cell</h4>');
        let info_widget = voronoi_viz.hud.create_element(voronoi_viz, 'info_bar', 'topright', voronoi_viz.tools.INFO_VIZ_TEXT);
        let horizontal_chart = voronoi_viz.hud.create_element(voronoi_viz, 'bar_chart', 'topright', voronoi_viz.tools.ICON_LOADING);
        let zone_table = voronoi_viz.hud.create_element(voronoi_viz, 'zone_table', 'bottomright');

        //make navigation bar arrows for dates invisible
        voronoi_viz.hud.set_nav_date_visible(0)
    }

    get_clock() {
        let control = L.control({
            position: 'topleft'
        });
        control.onAdd = function () {
            var div = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control-layers-expanded clock');
            div.innerHTML = 'Loading...';
            return div;
        };
        control.update = function () {
            //needs fixing as time end us being 1:1 instead of 01:01
            let now = new Date();
            let hh = now.getHours();
            let mm = now.getMinutes();
            let ss = now.getSeconds();
            // If datetime is today
            control.getContainer().innerHTML = 'Updated ' + ("0" + hh).slice(-2) + ':' + ("0" + mm).slice(-2);

        };
        return control;
    }
    //----------------------------------//
    //---------Drawing Links------------//
    //----------------------------------//

    //draws a link between two sites
    //[*link* is link id, *dur* is the animation duration, *color* (optional) link's color when drawn]
    //This function has further nested functions that I thought would not make sense as object methods, 
    //since those were only used in the context of draw_link()
    draw_link(voronoi_viz, link, dur, color) {

        //add the link_group to the canvas again 
        //(we detach it previously to make it invisible after mouseout is being performed)
        voronoi_viz.link_group = voronoi_viz.svg_canvas.append("g")
            .attr("transform", "translate(" + (-voronoi_viz.topLeft.x) + "," + (-voronoi_viz.topLeft.y) + ")");

        //find the sites that the link connects
        let connected_sites = voronoi_viz.site_db.all_links.find(x => x.id === link).sites;

        let from = voronoi_viz.site_db.get_node_from_id(voronoi_viz, connected_sites[0]);
        let to = voronoi_viz.site_db.get_node_from_id(voronoi_viz, connected_sites[1]);

        //acquire the direction of the link by checking if it's opposite exists.
        //If the opposite's drawn on screen, make arc's curvature inverse.
        let direction = voronoi_viz.links_drawn.includes(voronoi_viz.site_db.inverse_link(voronoi_viz, link)) ? "in" : "out";

        //calculate the speed deviation for the link in question
        let deviation = voronoi_viz.site_db.calculate_deviation(voronoi_viz, link) //negative slower, positive faster

        //acquire the minmax values for the color scale.
        //we create a new color scale, even though the old one exits
        //because the drawn links always colored based on speed deviation, 
        //whereas the general set_colorScale can be changed to speed ranges etc.
        let values = voronoi_viz.site_db.get_min_max(voronoi_viz);

        var scale = d3.scaleLinear()
            .domain([values.min, values.max])
            .range([values.min, values.max]);

        //if color's not defined, color the link based on speed deviation
        color = color == undefined ? voronoi_viz.set_color(scale(deviation)) : color;

        let strokeWeight = 5;

        //animate the line
        let link_line = generate_arc(from, to, direction, strokeWeight, color);
        let line_length = link_line.node().getTotalLength();
        animate_movement(link_line, line_length, dur);

        //add to the drawn list so we know what the opposite link's
        //direction is

        voronoi_viz.links_drawn.push(link);

        //----------Generating and Drawing Arcs--------//

        function generate_arc(A, B, direction, strokeWeight, stroke) {

            return voronoi_viz.link_group
                .append('path')
                .attr('d', curved_line(A.x, A.y, B.x, B.y, direction === "in" ? 1 : -1))
                .attr('class', 'arc_line')
                .style("fill", "none")
                .style("fill-opacity", 0)
                .attr("stroke", stroke)
                .attr("stroke-opacity", 1)
                .style("stroke-width", strokeWeight);
        }

        //compute the arc points given start/end coordinates
        //[start/end coordinates, dir stands for direction]
        function curved_line(start_x, start_y, end_x, end_y, dir) {

            //find the middle location of where the curvature is 0
            let mid_x = (start_x + end_x) / 2;

            let a = Math.abs(start_x - end_x);
            let b = Math.abs(start_y - end_y);

            //curvature height/or how curved the line is
            //[y offset in other words]
            let off = a > b ? b / 10 : 15;

            let mid_x1 = mid_x - off * dir;

            //calculate the slope of the arc line
            //let mid_y1 = voronoi_viz.slope(mid_x1, start_x, start_y, end_x, end_y);

            //computes the slope on which we place the arc lines
            //indicate links between sites
            let midX = (start_x + end_x) / 2;
            let midY = (start_y + end_y) / 2;
            let slope = (end_y - start_y) / (end_x - start_x);

            let mid_y1 = (-1 / slope) * (mid_x1 - midX) + midY;

            return ['M', start_x, start_y, // the arc start coordinates (where the starting node is)
                    'C', // This means we're gonna build an elliptical arc
                    start_x, ",", start_y, ",",
                    mid_x1, mid_y1,
                    end_x, ',', end_y
                ]
                .join(' ');
        }

        //animates lines being rendered as if they move through the map.
        //It's how we create a sense of directionality from links
        function animate_movement(line, outboundLength, dur) {

            return line
                .attr("stroke-dasharray", outboundLength + " " + outboundLength)
                .attr("stroke-dashoffset", outboundLength)
                .transition()
                .duration(dur)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0)
                .on("end",
                    function (d, i) {
                        // d3.select(this).remove()
                    }
                );
        }
    }

    //fills in the cells with color oafter the mode has been changed.
    //Important thing here-->deviation is calculated using:         
    //this.speedDeviation = this.travelSpeed - this.historicalSpeed;
    //hence if travelSpeed or historicalSpeed are null, the deviation becomes 0,
    //so we still have a value to fill the cell with. For current_speed and historical_speed
    //modes we get null, hence the gray color appearing

    color_transition(voronoi_viz, viz_type) {

        voronoi_viz.site_db.set_visualisations(voronoi_viz, viz_type)
        let set_color = voronoi_viz.set_color_range(voronoi_viz);

        voronoi_viz.polygon_group.selectAll(".cell")
            .transition()
            .duration('1000')
            .attr('fill', function (d, i) {

                let color = voronoi_viz.site_db.all[i].selected;
                if (color == null || color == undefined) {
                    return "rgb(50,50,50);"
                } else {
                    return set_color(color) //c10[i % 10]
                }
            })
    }

    //Generate a graph that is used by the Dijkstra algorithm.
    //Find all the weights for node edges between the *start* and *finish* nodes
    generate_graph(voronoi_viz, start, finish) {

        let graph = {};

        //iterate over the SITE_DB to find the start/finish nodes
        //and all the other nodes in between
        voronoi_viz.site_db.all.forEach((element) => {

            let neighbors = element.neighbors;

            let obj = {};

            //each neighbour is a node. Computes the weighted graph:
            neighbors.forEach((neighbor) => {

                //and the travel time between the nodes is the edge weight
                if (neighbor.site == start) {
                    obj["S"] = neighbor.travelTime; //or dist;
                }

                if (neighbor.site == finish) {
                    obj["F"] = neighbor.travelTime; //or dist;
                } else {
                    obj[neighbor.site] = neighbor.travelTime;
                }
            });

            if (element.name == start) {
                graph["S"] = obj;
            }

            if (element.name == finish) {
                graph["F"] = obj;

            } else {
                graph[element.name] = obj;
            }

        });
        return graph;
    }

    drawLinks(start_x, start_y, end_x, end_y, dur, fill) {

        let link_in = voronoi_viz.link_group
            .append('path')
            .attr('d', this.curved_line(start_x, start_y, end_x, end_y, 1))
            .style("fill", fill)
            .style("fill-opacity", 0)
            .attr("stroke", "blue")
            .attr("stroke-opacity", 0.5)
            .style("stroke-width", 2);

        let link_out = voronoi_viz.link_group
            .append('path')
            .attr('d', this.curved_line(end_x, end_y, start_x, start_y, -1))
            .style("fill", fill)
            .style("fill-opacity", 0)
            .attr("stroke", "red")
            .attr("stroke-opacity", 0.5)
            .style("stroke-width", 2)

        //we only calcuate the lenght once since it's the same for both directions
        let outboundLength = link_out.node().getTotalLength();


        //Drawing animation
        link_in
            .attr("stroke-dasharray", outboundLength + " " + outboundLength)
            .attr("stroke-dashoffset", outboundLength)
            .transition()
            .duration(dur)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end",
                function () {}
            );

        link_out
            .attr("stroke-dasharray", outboundLength + " " + outboundLength)
            .attr("stroke-dashoffset", outboundLength)
            .transition()
            .duration(dur)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end",
                function () {}
            );
    }

    drawRoutes(voronoi_viz) {

        for (let d = 0; d < voronoi_viz.site_db.all.length; d++) {

            let node_id = voronoi_viz.site_db.all[d].id;

            let neighbors = voronoi_viz.site_db.get_node_from_id(voronoi_viz, node_id).neighbors;

            for (let i = 0; i < neighbors.length; i++) {

                let x_coord = voronoi_viz.site_db.get_node_from_id(voronoi_viz, neighbors[i].id).x;
                let y_coord = voronoi_viz.site_db.get_node_from_id(voronoi_viz, neighbors[i].id).y;
            }
        }
    }

    change_modes(voronoi_viz) {
        d3.selectAll("input").on("change", function () {

            if (this.value === "current") {
                voronoi_viz.color_transition(voronoi_viz, "travel speed");
            }
            if (this.value === "deviation") {

                voronoi_viz.color_transition(voronoi_viz, "speed deviation");
            }
            if (this.value === "historical") {
                voronoi_viz.color_transition(voronoi_viz, "historical speed");
            }
            if (this.value === "routes") {
                voronoi_viz.polygon_group.remove();
                for (let j = 0; j < voronoi_viz.site_db.get_length(); j++) {

                    let node_id = voronoi_viz.site_db.all[j].node_id;

                    let neighbors = voronoi_viz.site_db.get_node_from_id(voronoi_viz, node_id).neighbors;

                    //possible bug where both directions appear the same colour
                    for (let i = 0; i < neighbors.length; i++) {
                        let inbound = neighbors[i].links.in.id;
                        let outbound = neighbors[i].links.out.id;

                        voronoi_viz.draw_link(voronoi_viz, inbound, 1000);
                        voronoi_viz.draw_link(voronoi_viz, outbound, 1000);
                    }
                }
            }
            if (this.value === "polygons") {
                voronoi_viz.draw_voronoi(voronoi_viz);
                voronoi_viz.generate_hull(voronoi_viz);
            }
        });
    }
    /*------------------------------------------------------*/
    /*-----------------HULL MANAGEMENT FUNCT----------------*/
    /*------------------------------------------------------*/

    //generates a hull around the different zones (north, south etc)
    generate_hull(voronoi_viz) {

        //on 'moveend' redeclare the voronoi_viz, otherwise the visualisaiton fails to load
        //since the 'this' becomes the 'moveend' object
        if (voronoi_viz.type == "moveend") {
            voronoi_viz = this;
        }

        //get a list of group ids  e.g (north, south, center etc)
        voronoi_viz.site_db.zones.forEach((group_id) => {

            let site_id_list = CELL_GROUPS[group_id]['acp_ids']
            let point_list = []
            let point_pairs = []

            //get a list of site IDs inside a group e.g ('SITE_CA31BF74-167C-469D-A2BF-63F9C2CE919A',... etc)
            site_id_list.forEach((site_acp_id) => {

                //elements that are off-screen bounds will return as undefined
                let element = d3.select('#' + site_acp_id).node();

                //therefore we look out for those and skip part of the function if that occurs
                if (element != undefined) {
                    let total_len = parseInt(element.getTotalLength());

                    for (let u = 0; u < total_len; u += 2) {
                        point_pairs.push([element.getPointAtLength(u).x, element.getPointAtLength(u).y])
                        point_list.push(element.getPointAtLength(u))
                    }
                }
            });

            //set concvity threshold for the algorithm so that its zoom-dependent
            let concavity_threshold;
            if (voronoi_viz.map._zoom <= 12) {
                concavity_threshold = 85
            } else {
                concavity_threshold = 185;
            }

            let defaultHull = d3.concaveHull().distance(concavity_threshold);
            let paddedHull = d3.concaveHull().distance(concavity_threshold).padding(5);

            CELL_GROUPS[group_id]['default_hull'] = defaultHull(point_pairs);
            CELL_GROUPS[group_id]['padded_hull'] = paddedHull(point_pairs);

            //'points' contains a set of x/y coordinates that denote the hull's line.
            //we use 'points' list rather than padded_zone_outline because we have to
            //reformat it to be used withing the d3.js context
            let points = []

            //zone outline in a single list -- to be reformated in the for loop below
            let padded_zone_outline = paddedHull(point_pairs)[0]

            if (padded_zone_outline != undefined) {
                for (let j = 0; j < padded_zone_outline.length; j++) {
                    points.push({
                        'x': padded_zone_outline[j][0],
                        'y': padded_zone_outline[j][1]
                    })
                }
            }
            CELL_GROUPS[group_id]['points'] = points;
        })
    }

    //works in tandem with generate_hull() to draw the hull outline
    get_outline(voronoi_viz, zone_id) {

        let cell_group_list = Object.keys(CELL_GROUPS);

        var lineFunction = d3.line()
            .x(function (d, i) {
                return d.x;
            })
            .y(function (d, i) {
                return d.y;
            });

        if (zone_id != undefined) {
            voronoi_viz.zone_outlines.append("g")
                .append("path")
                .attr('class', 'zone_outline')
                .attr("d", lineFunction(CELL_GROUPS[zone_id]['points']))
                .style("stroke-width", 5)
                .style("stroke", CELL_GROUPS[zone_id]['color'])
                .style("fill", "none")
                .style("opacity", 0)
                .transition()
                .duration(500)
                .ease(d3.easeLinear)
                .style("opacity", 1)
                .on("end", function (d, i) {}); //do something on end
        } else {
            for (let j = 0; j < cell_group_list.length; j++) {
                voronoi_viz.zone_outlines.append("g")
                    .append("path")
                    .attr('class', 'zone_outline')
                    .attr("d", lineFunction(CELL_GROUPS[cell_group_list[j]]['points']))
                    .style("stroke-width", 5)
                    .style("stroke", CELL_GROUPS[cell_group_list[j]]['color'])
                    .style("fill", "none")
                    .style("opacity", 0)
                    .transition()
                    .duration(500)
                    .ease(d3.easeLinear)
                    .style("opacity", 1)
                    .on("end", function (d, i) {}); //do something on end
            }
        }
    }

    /*------------------------------------------------------*/
    /*-----------------SELECTION FUNCT----------------------*/
    /*------------------------------------------------------*/

    select_cell(voronoi_viz, id) {
        voronoi_viz.deselect_all(voronoi_viz)
        let cell = document.getElementById(id)
        let node = voronoi_viz.site_db.get_node_from_acp_id(voronoi_viz, id)
        voronoi_viz.site_db.set_selected_node(voronoi_viz, node)
        voronoi_viz.cell_clicked(cell)
    };

    select_all(voronoi_viz) {
        let cells = document.getElementsByClassName("cell")
        for (let i = 0; i < cells.length; i++) {
            voronoi_viz.cell_clicked(cells[i])
        }
    };

    deselect_all(voronoi_viz) {
        let cells = document.getElementsByClassName("cell")
        for (let i = 0; i < cells.length; i++) {
            voronoi_viz.cell_regular(cells[i])
        }
    };

    //cell manipulation + interactivity
    cell_mouseover(cell) {
        d3.select(cell).transition()
            .duration('300')
            .style('stroke', 'black')
            .style("stroke-opacity", 1)
            .style("fill-opacity", 0.85);
    };
    cell_mouseout(cell) {
        d3.select(cell).transition()
            .duration('300')
            .style('stroke', 'black')
            .style("stroke-opacity", 0.3)
            .style("fill-opacity", 0.3);
    };

    cell_clicked(cell) {
        d3.select(cell)
            .style('stroke-opacity', 1)
            .style('stroke', 'black')
            .style('stroke-width', 4);
    };

    cell_regular(cell) {
        d3.select(cell)
            .style('stroke', 'black')
            .style('stroke-width', 0.5)
            .style("stroke-opacity", 0.3)
            .style("fill-opacity", 0.3);
    };

    /*------------------------------------------------------*/
    /*----------------/SELECTION FUNCT----------------------*/
    /*------------------------------------------------------*/
}