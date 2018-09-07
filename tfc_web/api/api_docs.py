
import coreapi
import coreschema

# Ideally these would be defined by calling django.urls.reverse(), but
# the resulting string is used inside urls.py at a time when both
# reverse() and reverse_lazy() can't be called.
params = {
    'aq_home': '/aq/',
    'parking_home': '/parking/',
    'traffic_home': '/traffic/',
    'login': '/accounts/login/',
    'create': '/api/create-token/',
    'manage': '/api/tokens/',
}

api_description = '''

This API provides programmatic access to information maintained by the
Smart Cambridge project.

Currently available:

* [Air Quality]({aq_home}) data from a selection of sensors deployed
around Cambridge between June 2016 and February 2017.

* [Car Parking]({parking_home}) data showing the occupancy of Cambridge
City Centre and Park and Ride car parks from 2017 onward.

* [Traffic Speed]({traffic_home}) data for a number of roads within
Cambridge based on bus position reports from October 2017 onward.

* API access to bus transport data from the
[National Public Transport Access Nodes (NaPTAN)](https://data.gov.uk/dataset/ff93ffc1-6656-47d8-9155-85ea0b8f2251/national-public-transport-access-nodes-naptan)
and
[Traveline National Dataset (TNDS)](http://www.travelinedata.org.uk/traveline-open-data/traveline-national-dataset/)
resources.

The API operates over HTTP using REST-like conventions with parameters
encoded in URL paths and query parameters. It can be accessed by any
tool capable of making HTTP requests and interpreting the results. This
page, if accessed with an `Accept:application/coreapi+json` header will
return a machine-readable description of the API in
[CoreAPI](http://www.coreapi.org/) format but its use is not restricted
to CoreAPI-aware tools.

# Authentication

All API calls must be authenticated. You can make authenticated API
calls either by [logging in to this website]({login}), or by including
an API token with the call. Beware that API calls made from browsers,
for example from JavaScript, will succeed without a token for as long as
you are logged in to this website but not otherwise.

To interact with the API using the links below you can authenticate
using the 'Authentication' menu at the bottom-left of this page.

You can [create]({create}) and subsequently [manage]({manage}) as many
API tokens as you want.

To use a token for authentication you should include it in an
`Authorization` HTTP header in your requests, proceeded by the word
`Token` and a single space:

    Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b

For example:

    curl -X GET https://smartambridge.org/api/v1/aq/ -H 'Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b' 

Tokens used by JavaScript applications are of necessity exposed. To
minimise the impact of this you can associate any token with a list of
'referer' patterns. Access using that token will then be rejected if the
'Referer' header provided by a browser don't match any of the patterns.
While this is easily subverted in server-side scripts and by using
custom proxies it does make it slightly harder to misuse tokens exposed
in this way.

Patterns that don't include a `/` character are compared with the host
name component of the referer URL only. Patterns containing at least one
`/` are compared against the entire referer URL. Patterns can include
shell-style wildcard characters: `*` matches anything (including
nothing), `?` matches a single character, `[seq]` matches any character
in `seq`, and `[!seq]` matches any character not in `seq`. For a literal
match wrap meta-characters in brackets, for example `[?]` matches the
character `?`. A pattern must compare exactly (allowing for wildcards)
to count as matched.

You can setup referer restrictions on tokens from the [token management
page]({manage}).

# Rate limiting

Access to the API is rate-limited to 1200 requests per minute
and 12000 requests per hour per token for token-based access, or per
user otherwise.

# Results format

Results are normally returned in [JSON](https://www.json.org/) with
`Content-Type: application/json`. However if a response is explicitly
requested in HTML by including an 'Accept: text/html' header in the
request (as happens if the API is accessed directly from a browser) then
results are returned in human-friendly HTML.

Successful responses have HTTP status codes of `200 OK`. Other status
codes (at least `400 Bad Request`, `401 Authorization Required`, and `404
Not Found`) indicate an error. Most errors include an `application/json`
body containing further information. Some errors, in particular any that
generate bogus URLs, generate generic HTML `404 Not found` pages with
`Content-Type: text/html`.

Individual output formats are not currently documented, but should be
self-explanatory. API calls that return lists of data items may return a
`200 OK` response with an empty list, rather than `404 Not found`, if
called with a valid request for which there happens to be no data
available (e.g because of the chosen date range).

'''.format(**params)

station_id_fields = [
    coreapi.Field(
        "station_id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Air quality sensor station id (e.g. 'S-1134')"),
        description="Air quality sensor station id (e.g. 'S-1134')",
        example="S-1134",
    ),
]

parking_id_fields = [
    coreapi.Field(
        "parking_id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Car park identifier (e.g. 'grafton-east-car-park')"),
        description="Car park identifier (e.g. 'grafton-east-car-park')",
        example="grafton-east-car-park",
    ),
]

zone_id_fields = [
    coreapi.Field(
        "zone_id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Zone identifier (e.g. 'east_road_in')"),
        description="Zone identifier (e.g. 'east_road_in')",
        example="east_road_in",
    ),
]

aq_history_fields = [
    coreapi.Field(
        "station_id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Air quality station id (e.g. 'S-1134')"),
        description="Air quality station id (e.g. 'S-1134')",
        example="S-1134",
    ),
    coreapi.Field(
        "sensor_type",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Air quality sensor id (e.g. 'NO2')"),
        description="Air quality sensor id (e.g. 'NO2')",
        example="NO2",
    ),
    coreapi.Field(
        "month",
        required=True,
        location="path",
        schema=coreschema.String(
            description="The month for which to return data. YYYY-MM "
                        "(e.g. '2016-06')"),
        description="The month for which to return data. YYYY-MM "
                    "(e.g. '2016-06')",
        example="2016-06",
    ),
]

list_args_fields = [
    coreapi.Field(
        "start_date",
        required=True,
        location="query",
        schema=coreschema.String(
            description="Start date for returned data. YYYY-MM-DD "
                        "(e.g. '2018-01-01')"),
        description="Start date for returned data. YYYY-MM-DD "
                    "(e.g. '2018-01-01')",
        example="2018-01-01",
    ),
    coreapi.Field(
        "end_date",
        location="query",
        schema=coreschema.String(
            description="End date for returned data. YYYY-MM-DD "
            "(e.g. '2018-01-15'). Defaults to start_date and must be no "
            "more than 31 days from start_date"),
        description="End date for returned data. YYYY-MM-DD "
            "(e.g. '2018-01-15'). Defaults to start_date and must be no "
            "more than 31 days from start_date",
        example="2018-01-15",
    ),
]
