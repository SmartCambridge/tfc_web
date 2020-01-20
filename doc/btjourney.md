Files in `/media/tfc/btjourney/`
================================

'\*' indicates files used by the API

## `link_data/data_bin/<YYYY>/<MM>/<DD>/<EPOC>_<YYYY>-<MM>-<DD>-<HH>-<MM>-<SS>.json`

Archived liveJourneyTime API responses:

```
{
    "request_data": <API response>,
    "ts": <EPOC>
}
```

## \*`link_data/data_link/<YYYY>/<MM>/<DD>/<LINK_ID>_<YYYY>-<MM>-<DD>.txt`

'Newline separated JSON' containing entries from the liveJourneyTimes
API for particular links (and compoundRoutes) with an additional "ts" key for time of observation:

```
{ "id": <LINK_ID>, "time": ..., "period": ..., "travelTime": ..., "normalTravelTime": ..., "ts": <EPOC> }
{ "id": <LINK_ID>, "time": ..., "period": ..., "travelTime": ..., "normalTravelTime": ..., "ts": <EPOC> }
```

Beware that <LINK_ID> contains a '|' character that needs to be escaped from the shell.

## \*`link_data/data_monitor/post_data.json`

Most recent liveJourneyTime API responses:

```
{
    "request_data": <API response>,
    "ts": <EPOC>
}
```

## `locations/data_bin/<YYYY>/<MM>/<DD>/<EPOC>_<YYYY>-<MM>-<DD>-<HH>-<MM>-<SS>.json`

Archived location API responses:

```
{
    "request_data": <API response>,
    "ts": <EPOC>
}
```

## \*`locations/data_link/<LINK_ID>.json`

Most recent individual link or compoundRoute entry from location API response with additional "ts" key for time of observation:

```
{
    "id": ...,
    "name": ...,
    "description": ...,
    "sites": [ <SITE_ID>, ... ],
    "links": [ <LINK_ID>, ... ],
    "length": ...,
    "ts": <EPOC>
}
```

`links` key only appears for links that were originally compoundRoutes.

Entry for links accumulate and are never deleted.

Beware that <LINK_ID> contains a '|' character that needs to be escaped from the shell.

## `locations/data_monitor/post_data.json`

Most recent location API response:

```
{
    "request_data": <API response>,
    "ts": <EPOC>
}
```

## \*`locations/data_site/<SITE_ID>.json`

Most recent site entry from locations API response with additional "ts" key:

```
{
    "id": ...,
    "name": ...,
    "description": ...,
    "location": {
        "lat": ...,
        "lng": ...
    },
    "ts": <EPOC>
}
```
Entry for sites accumulate and are never deleted.

Beware that <SITE_ID> contain '{' and '}' characters that need to be escaped from the shell.

API
===

## `/api/v1/btjourney/link/`

Metadata for all links (incl. compound routes)

## `/api/v1/btjourney/link/{link_id}`/

Metadata for link `link_id`

## `/api/v1/btjourney/site/`

Metadata for all sites

## `/api/v1/btjourney/site/{site_id}`/

Metadata for site `site_id`

## `/api/v1/btjourney/history/{link_id}/?start_date=<>&end_date=<>`

Historic journey time data for `link_id`

## `/api/v1/btjourney/latest/`

Most recent journey time data for all current links

## `/api/v1/btjourney/latest/{link_id}/`

Most recent journey time data for link `link_id`


