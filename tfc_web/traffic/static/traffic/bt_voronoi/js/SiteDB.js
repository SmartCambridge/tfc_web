"use strict";

class SiteDB {
//site_db has all of the queried data, data querying functions and the ability to
//retrieve any nodes based on their id, acp_id or name properties
    constructor() {

        this.all = [];

        this.selected_site = null;
        this.all_sites, this.all_routes, this.all_journeys, this.all_links = [];

        //CELL_GROUPS are located in the cell_groups.js file
        this.zones = Object.keys(CELL_GROUPS);
    }

    /*------------------------------------------------------*/

    async load_api_data(voronoi_viz) {

        await Promise.all([load_sites(), load_routes(), load_links(), load_journeys()]).then((combined_api_reponse) => {


            let site_response = combined_api_reponse[0]
            let route_response = combined_api_reponse[1]
            let link_response = combined_api_reponse[2]
            let journey_response = combined_api_reponse[3]


            voronoi_viz.site_db.all_sites = site_response.site_list;
            voronoi_viz.site_db.all_routes = route_response.route_list
            voronoi_viz.site_db.all_links = link_response.link_list;
            voronoi_viz.site_db.all_journeys = journey_response.request_data;

            /*--------------------------DATA CLEANUP-----------------------------*/

            //Some genious assumed that it was OK to use | vertical bars for link ids 
            //(e.g CAMBRIDGE_JTMS|9800WLZSM8UU), thus not only messing up the ability 
            //to access such links with D3.js or regex but also not being able to 
            //reference it in XML for SVG paths.
            //So here I delete the vertical bars and replace it with '_' so
            // the actual unique link value becomes CAMBRIDGE_JTMS_9800WLZSM8UU

            voronoi_viz.site_db.all_links.forEach((element) => {
                element.id = element.id.replace('|', '_');
            });;

            voronoi_viz.site_db.all_journeys.forEach((element) => {
                element.id = element.id.replace('|', '_');
            });
            //For site, we have to add a prefix SITE_ in front of site ids,
            //'{1F867FB8-83E6-4E63-A265-51CD2E71E053}' =>'SITE_{1F867FB8-83E6-4E63-A265-51CD2E71E053}', 
            //otherwise we will not be able to select site id from html id tag
            //because it will start with an invalid character '{'
            voronoi_viz.site_db.all_sites.forEach((element) => {
                element.acp_id = voronoi_viz.tools.SITE_PREFIX + element.id.replace('{', '').replace('}', '');
            });
        })

        // .fail(function () {
        //     console.log('API call failed - default reschedule');
        //     setTimeout(load_data, 60000);
        // });
    }

    //returns a link based on the in/out sites
    find_links(voronoi_viz, id1, id2) {

        //id1 from (outbound)
        //id2 to (inbound)

        let obj = {
            "out": null,
            "in": null
        }

        for (let i = 0; i < voronoi_viz.site_db.all_links.length; i++) {
            if (id1 == voronoi_viz.site_db.all_links[i].sites[0] && id2 == voronoi_viz.site_db.all_links[i].sites[1]) {
                obj["out"] = voronoi_viz.site_db.all_links[i];
            }
            if (id1 == voronoi_viz.site_db.all_links[i].sites[1] && id2 == voronoi_viz.site_db.all_links[i].sites[0]) {
                obj["in"] = voronoi_viz.site_db.all_links[i];
            }
        }
        return obj;
    }

    initialise_nodes(voronoi_viz) {
        for (let i = 0; i < voronoi_viz.site_db.all_sites.length; i++) {

            let node = new Node(voronoi_viz,voronoi_viz.site_db.all_sites[i].id)

            node.lat = voronoi_viz.site_db.all_sites[i].acp_lat;
            node.lng = voronoi_viz.site_db.all_sites[i].acp_lng;

            node.find_neighbors(voronoi_viz);
            node.compute_travel_time(voronoi_viz);
            node.compute_travel_speed(voronoi_viz);
            node.set_visualisation(null); //speed deviation//travel speed

            voronoi_viz.site_db.all.push(node);
        }
    }

    update_nodes(voronoi_viz) {
        voronoi_viz.site_db.all=[];
        voronoi_viz.site_db.initialise_nodes(voronoi_viz)
    }

    //find the opposite of the link by looking at the *to* and *from*
    //nodes and changing the directionality
    inverse_link(voronoi_viz, link) {
        let connected_sites = voronoi_viz.site_db.all_links.find(x => x.id === link).sites;

        let from = voronoi_viz.site_db.get_node_from_id(voronoi_viz, connected_sites[0]);
        let to = voronoi_viz.site_db.get_node_from_id(voronoi_viz, connected_sites[1]);

        let links = voronoi_viz.site_db.find_links(voronoi_viz, from.node_id, to.node_id);
        return link === links.in.id ? links.out.id : links.in.id;
    }


    //calculates speed deviation for a given link
    calculate_deviation(voronoi_viz, link) {
        //find the physical length of the requested link
        let dist = voronoi_viz.site_db.all_links.find(x => x.id === link).length;

        let travelTime, normalTravelTime;
        
        //get travel time and normal travel time, if travel time is undefined replace it with normal travel time
        try {
            travelTime = voronoi_viz.site_db.all_journeys.find(x => x.id === link).travelTime;
            normalTravelTime = voronoi_viz.site_db.all_journeys.find(x => x.id === link).normalTravelTime;
        } catch {
            return undefined
        }

        if (travelTime == null || travelTime == undefined) {
            travelTime = normalTravelTime;
        }

        //convert time and distance to speed
        let current = (dist / travelTime) * voronoi_viz.tools.TO_MPH;
        let normal = (dist / normalTravelTime) * voronoi_viz.tools.TO_MPH; //historical speed

        //negative speed is slower, positive speed is faster
        return current - normal;
    }

    //compute average speed data for groups of nodes
    get_zone_averages(voronoi_viz) {
        let zones = voronoi_viz.site_db.zones;
        let zone_readings = [];
        for (let i = 0; i < zones.length; i++) {
            let zone_temp = []
            voronoi_viz.site_db.all.filter(node => node.zone == zones[i]).forEach(zone_node => zone_temp.push(zone_node.travelSpeed))
            zone_readings.push({
                'zone': zones[i],
                'value': voronoi_viz.tools.array_avg(zone_temp)
            })
        }
        return zone_readings
    }

    set_selected_node(voronoi_viz, new_selection) {
        voronoi_viz.site_db.selected_site = new_selection;
    }
    get_selected_node(voronoi_viz) {
        return voronoi_viz.site_db.selected_site;
    }

    //computs min and max values from the data
    //this lets us create appropriate color ranges
    get_min_max(voronoi_viz) {
        //finds min/max from the *selected* setting 
        //(can be speed deviation, current speed, normal speed)
        let findMax = (ma, v) => Math.max(ma, v.selected)
        let findMin = (mi, v) => Math.min(mi, v.selected)

        let max = voronoi_viz.site_db.all.reduce(findMax, -Infinity)
        let min = voronoi_viz.site_db.all.reduce(findMin, Infinity)

        //we used placeholder value during development
        //to privide higher color differences

        return {
            "min": min, //-5
            "max": max //10
        };
    }

    //these 'getters' are slighty long but it was better than just
    //using e.g. get_acp_id(node_acp_id) to return a node from its acp_id. 

    //returns a node based on its node acp_id property
    get_node_from_acp_id(voronoi_viz, node_acp_id) {
        return voronoi_viz.site_db.all.find(x => x.node_acp_id === node_acp_id);
    }

    //returns a node based on its node id property
    get_node_from_id(voronoi_viz, node_id) {
        return voronoi_viz.site_db.all.find(x => x.node_id === node_id);
    }

    //returns a node based on its node name property
    get_node_from_name(voronoi_viz, node_name) {
        return voronoi_viz.site_db.all.find(x => x.name === node_name);
    }

    //returns a node based on its node name property
    get_length(voronoi_viz) {
        return this.all.length; //>breaks if you do voronoi_viz.site_db.all.length
    }

    set_visualisations(voronoi_viz, viz_type) {
        voronoi_viz.site_db.all.forEach((element) => {
            element.set_visualisation(viz_type);
        });
    }
}