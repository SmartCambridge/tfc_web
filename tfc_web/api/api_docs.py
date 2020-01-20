
import coreapi
import coreschema

# Ideally these would be defined by calling django.urls.reverse(), but
# the resulting string is used inside urls.py at a time when both
# reverse() and reverse_lazy() can't be called.

api_description = '''
Programmatic access to data held by the Smartcambridge project.

See [the main API documentation](/api/) for important information about
using this API, **in particular about the need for authentication**.
'''

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

link_or_route_id_fields = [
    coreapi.Field(
        "id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Identifier for a link or route (e.g. 'CAMBRIDGE_JTMS|9800W1CHALH6' or 'CAMBRIDGE_JTMS|9800WMBVAGBF')"),
        description="Identifier for a link or route (e.g. 'CAMBRIDGE_JTMS|9800W1CHALH6' or 'CAMBRIDGE_JTMS|9800WMBVAGBF')",
        example="CAMBRIDGE_JTMS|9800W1CHALH6",
    ),
]

site_id_fields = [
    coreapi.Field(
        "site_id",
        required=True,
        location="path",
        schema=coreschema.String(
            description="Site identifier (e.g. '{0D7C672E-EEE9-4924-815E-B49CC382DFFA}')"),
        description="Site identifier (e.g. '{0D7C672E-EEE9-4924-815E-B49CC382DFFA}')",
        example="{0D7C672E-EEE9-4924-815E-B49CC382DFFA}",
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

transport_pagination_fields = [
    coreapi.Field(
        "page",
        required=False,
        location="query",
        schema=coreschema.Integer(
            description="A page number within the paginated result set "
                        "(e.g. 2). Default 1"),
        description="A page number within the paginated result set. "
                    "(e.g. 2)",
        example="2",
    ),
    coreapi.Field(
        "page_size",
        required=False,
        location="query",
        schema=coreschema.Integer(
            description="Number of results to return per page. "
                        "(e.g. 10). Default 25, maximum 50."),
        description="Number of results to return per page. "
                    "(e.g. 10). Default 25, maximum 50.",
        example="10",
        )
    ]

transport_stops_pagination_fields = [
    coreapi.Field(
        "page",
        required=False,
        location="query",
        schema=coreschema.Integer(
            description="A page number within the paginated result set "
                        "(e.g. 2). Default 1"),
        description="A page number within the paginated result set. "
                    "(e.g. 2)",
        example="2",
    ),
    coreapi.Field(
        "page_size",
        required=False,
        location="query",
        schema=coreschema.Integer(
            description="Number of results to return per page. "
                        "(e.g. 10). Default 50, maximum 200."),
        description="Number of results to return per page. "
                    "(e.g. 10). Default 50, maximum 200.",
        example="10",
        )
    ]
