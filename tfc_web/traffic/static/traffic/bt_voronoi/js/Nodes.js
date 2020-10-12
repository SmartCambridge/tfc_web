"use strict";

class Node {
    //Node class is responsible for having all the data for individual nodes
    // that are used to render cells on the screen

    constructor(voronoi_viz,node_id) {

        this.node_id = node_id; //node_id
        this.node_acp_id = 'SITE_' + this.node_id.replace('{', '').replace('}', '');

        this.lat = null;
        this.lng = null;
        this.x = null;
        this.y = null;

        this.neighbors = [];

        this.travelTime = null;
        this.travelSpeed = null;
        this.historicalSpeed = null;
        this.speedDeviation = null;

        //selected variable output - tt,ts,hs or sd
        this.selected = null;
        this.selectedName = null;

        this.zone = this.get_zone();
        this.name = this.get_name(voronoi_viz);
    }

    //returns the zone that the node belongs to (east, west, north, south, center)
    get_zone() {
        let groups = Object.keys(CELL_GROUPS);
        for (let i = 0; i < groups.length; i++) {
            let group_id = groups[i];
            if (CELL_GROUPS[group_id]['acp_ids'].includes(this.node_acp_id)) {
                return group_id;
            }
        }
    }

    //returns the name of the node
    get_name(voronoi_viz) {
        return voronoi_viz.site_db.all_sites.find(x => x.id === this.node_id).name;
    }

    //returns the name of the node based on the id
    get_name_from_id(voronoi_viz, id) {
        return voronoi_viz.site_db.all_sites.find(x => x.id === id).name;
    }

    //sets the default visualisation value
    set_visualisation(vis) {
        this.selectedName = vis;
        switch (vis) {
            case "historical speed":
                this.selected = this.historicalSpeed;
                break;
            case "travel speed":
                this.selected = this.travelSpeed;
                break;
            case "speed deviation":
                this.selected = this.speedDeviation;
                break;
            default:
                this.selected = this.speedDeviation; //this.travelSpeed;
                break;
        }
    }

    //returns the location of the node
    get_location(voronoi_viz) {
        let data = voronoi_viz.site_db.all_sites; //"this.sites;
        for (let i = 0; i < data.length; i++) {
            if (this.node_id == data[i].id) {
                return {
                    "x": data[i].x,
                    "y": data[i].y
                }
            }
        }
    }

    //adds the list of surrounding neigbour nodes to the node metadata
    find_neighbors(voronoi_viz){ //data is in all_links
        this.neighbors = [];
        let tempTravelTime, normalTravelTime, travelTime; //temp
        //iterate over all of the links
        for (let i = 0; i < voronoi_viz.site_db.all_links.length; i++) {
            //check if the source site matches our initial node
            if (this.node_id == voronoi_viz.site_db.all_links[i].sites[0]) { //from this id

                //try obtaining travel time and normal travel time. if travel time is undefined, select normal travel time instead.
                try {
                    tempTravelTime = voronoi_viz.site_db.all_journeys.find(x => x.id === voronoi_viz.site_db.all_links[i].id).travelTime;
                    normalTravelTime = voronoi_viz.site_db.all_journeys.find(x => x.id === voronoi_viz.site_db.all_links[i].id).normalTravelTime;
                    travelTime = tempTravelTime == undefined || null ? normalTravelTime : tempTravelTime;
                } catch (err) {
                    travelTime = undefined;
                    normalTravelTime = undefined;
                }

                //console.log(tempTravelTime, travelTime);
                //find a link that has the same to/from nodes to acquire a unique id
                let link = voronoi_viz.site_db.find_links(voronoi_viz, this.node_id, voronoi_viz.site_db.all_links[i].sites[1]);//to this id
                this.neighbors.push({
                    "links": {
                        "out": link.out,
                        "in": link.in
                    },
                    "name": voronoi_viz.site_db.all_links[i].name,
                    "id": voronoi_viz.site_db.all_links[i].sites[1], //to this id
                    "site": this.get_name_from_id(voronoi_viz, voronoi_viz.site_db.all_links[i].sites[1]),
                    "travelTime": travelTime,
                    "normalTravelTime": normalTravelTime,
                    "dist": voronoi_viz.site_db.all_links[i].length
                });
            }
        }
    }

    //calculates travel time to to and from every neighbour
    compute_travel_time(voronoi_viz) {
        let avg = [];
        let sum = 0;

        //iterate over all of the neighours
        for (let i = 0; i < this.neighbors.length; i++) {
            let link = this.neighbors[i].links.out.id;

            //iterate over all of the journeys that exist within neighours
            for (let u = 0; u < voronoi_viz.site_db.all_journeys.length; u++) {
                if (link == voronoi_viz.site_db.all_journeys[u].id) {
                    avg.push(voronoi_viz.site_db.all_journeys[u].travelTime);
                }
            }
        }

        for (let i = 0; i < avg.length; i++) {
            sum += avg[i];
        }
        this.travelTime = sum / avg.length;
    }

    //calculates travel speed to to and from every neighbour
    compute_travel_speed(voronoi_viz) {
        let currentAverage = [];
        let historicalAverage = [];

        //iterate over all of the neighours
        for (let i = 0; i < this.neighbors.length; i++) {
            let link = this.neighbors[i].links.out.id;
            let dist = this.neighbors[i].dist;

            //iterate over all of the journeys that exist within neighours
            for (let u = 0; u < voronoi_viz.site_db.all_journeys.length; u++) {
                if (link == voronoi_viz.site_db.all_journeys[u].id) {
                    let travelTime = voronoi_viz.site_db.all_journeys[u].travelTime;
                    let historicalTime = voronoi_viz.site_db.all_journeys[u].normalTravelTime;

                    let currentSpeed = (dist / travelTime) * voronoi_viz.tools.TO_MPH;
                    let historicalSpeed = (dist / historicalTime) * voronoi_viz.tools.TO_MPH;

                    if (currentSpeed == Infinity || historicalSpeed == Infinity) {
                        continue;
                    }

                    historicalAverage.push(historicalSpeed);
                    currentAverage.push(currentSpeed);
                }
            }
        }
        if (historicalAverage.length > 0) {
            let historicalSum = historicalAverage.reduce((previous, current) => current += previous);
            this.historicalSpeed = historicalSum / historicalAverage.length;
        }

        if (currentAverage.length > 0) {
            let currentSum = currentAverage.reduce((previous, current) => current += previous);
            this.travelSpeed = currentSum / currentAverage.length;
        }

        //if this.travelSpeed or this.historicalSpeed are null, we get 0 and thus fill in the 
        //cell as the neutral yellow-orange color
        this.speedDeviation = this.travelSpeed - this.historicalSpeed;
    }
}