"use strict";

async function load_road_svg() {
    return await d3.svg('./static/roads_test.svg');
}

async function load_journeys() {
    return await d3.json(JOURNEY_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_links() {
    return await d3.json(LINK_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_routes() {
    return await d3.json(ROUTE_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_sites() {
    return await d3.json(SITE_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}

