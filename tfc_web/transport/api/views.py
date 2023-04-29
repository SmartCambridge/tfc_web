import coreapi
import coreschema
from datetime import timedelta
from dateutil.parser import parse
from django.contrib.gis.geos import Polygon
from django.urls import reverse
from django.utils.timezone import now
from rest_framework import generics, filters
from rest_framework.decorators import api_view, renderer_classes, schema, \
    authentication_classes, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import ManualSchema, AutoSchema
from transport.api.serializers import VehicleJourneySerializer, \
    VehicleJourneySummarisedSerializer, StopSerializer, JourneyPatternSerializer
from transport.models import VehicleJourney, Stop
from urllib.parse import quote
import re
from api.auth import default_authentication, default_permission, \
    default_throttle


DAYS = [ ['Monday', 'Monday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Tuesday', 'Tuesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Wednesday', 'Wednesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Thursday', 'Thursday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Friday', 'Friday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Saturday', 'Saturday', 'Weekend', 'MondayToSaturday', 'MondayToSunday'],
         ['Sunday', 'Sunday', 'Weekend', 'MondayToSunday'] ]


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


class Pagination(PageNumberPagination):
    page_size = 25
    max_page_size = 500
    page_size_query_param = 'page_size'


class LongPagination(PageNumberPagination):
    page_size = 250
    max_page_size = 500
    page_size_query_param = 'page_size'


def string_to_datetime(str_time):
    try:
        time = parse(str_time)
    except:
        return None
    return time

journeys_by_time_and_stop_schema = ManualSchema(
    fields=[
        coreapi.Field(
            "stop_id",
            required=True,
            location="query",
            schema=coreschema.String(
                description="Stop atco_code "
                            "(e.g. '0500CCITY111')"),
            description="Stop atco_code (e.g. '0500CCITY111')",
            example='0500CCITY111',
        ),
        coreapi.Field(
            "datetime_from",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Start datetime or time for returned results. "
                            "If time is given insetad of a datetime, "
                            "today is used as date. Defaults to now. "
                            "YYYY-MM-DDTHH:MM:SS or HH:MM:SS "
                            "(e.g. '2018-06-01T12:00:00')"),
            description="Start datetime or time for returned results. "
                        "If time is given insetad of a datetime, "
                        "today is used as date. Defaults to now. "
                        "YYYY-MM-DDTHH:MM:SS or HH:MM:SS "
                        "(e.g. '2018-06-01T12:00:00')",
            example="2018-06-01T12:00:00",
        ),
        coreapi.Field(
            "nresults",
            required=False,
            location="query",
            schema=coreschema.Integer(
                description="Maximum number of journeys to return, default "
                            "10. (e.g. 20)"),
            description="Maximum number of journeys to return, default 10. "
                        "(e.g. 20)",
            example="20",
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(
                description="Expands the resulting journey into a full "
                            "journey object"),
            description="Expands the resulting journey into a full "
                        "journey object",
        ),
    ],
    description="Return the timetabled vehicle journeys expected for a given "
                "stop identified by _stop_id_ from a specific date and time "
                "identified by _datetime_from_ (optional, default = now). "
                "\n\n"
                "All results are paginated based on _nresults_ and a _next_ "
                "attribute is returned containing the URL to use to retrieve "
                "more results. The pagination can return up to _nresults_ "
                "or less if there are no more results for a day, for example."
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@authentication_classes(default_authentication)
@permission_classes(default_permission)
@throttle_classes(default_throttle)
@schema(journeys_by_time_and_stop_schema)
def journeys_by_time_and_stop(request):
    try:
        stop_id = request.GET['stop_id']
    except:
        return Response({"details": "stop_id not present"}, status=400)
    try:
        stop = Stop.objects.get(atco_code=stop_id)
    except:
        return Response({"details": "Stop %s not found" % stop_id}, status=404)
    datetime_from = string_to_datetime(request.GET['datetime_from']) if 'datetime_from' in request.GET else now()
    if not datetime_from:
        return Response({"details": "datetime_from badly formatted"}, status=400)
    try:
        nresults = int(request.GET['nresults']) if 'nresults' in request.GET else 10
    except:
        return Response({"details": "nresults is not an int"}, status=400)
    if nresults < 1:
        return Response({"details": "nresults is should be at least 1"}, status=400)

    departures = stop.next_departures(datetime_from)
    departures = departures[:nresults]

    # Convert all stop_id to full stop objects
    stop_ids_list = []
    for departure in departures:
        for timetable_entry in departure['timetable']:
            stop_ids_list.append(timetable_entry['stop_id'])
    # This means that we only rely on 1 single SQL query to get all the stops, making it faster
    stop_objects = list(Stop.objects.filter(atco_code__in=stop_ids_list))
    for departure in departures:
        for timetable_entry in departure['timetable']:
            timetable_entry['stop'] = StopSerializer(
                next((stop for stop in stop_objects if stop.atco_code == timetable_entry['stop_id']), None)).data

    if len(departures) < nresults:
        # no more results for the current day selected
        next_datetime = datetime_from.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    else:
        while departures[-1]['time'] == departures[-2]['time'] and len(departures) > 2:
            # Remove from the result entries with the same leaving time
            departures = departures[:-1]
        if departures[-1]['time'] == departures[-2]['time'] and len(departures) == 2:
            # Exceptional case where all entries have the same leaving time, in this case we return 0 results and
            # increase the nresult of the next query
            next_datetime = departures[-1]['time']
            nresults += 1
            departures = []
        else:
            # Remove the last entry that was only used to see if there are buses leaving at the same time
            next_datetime = departures[-1]['time']
            departures = departures[:-1]

    results_json = {'results': []}
    for result in departures:
        journey = VehicleJourneySummarisedSerializer(result['vehicle_journey']).data
        journey['timetable'] = result['timetable']
        results_json['results'].append({
            'time': result['time'],
            'journey': journey
                if request.GET.get('expand_journey', 'false').lower() == 'true' else result['vehicle_journey'].id,
            #'line': LineSerializer(result.vehicle_journey.journey_pattern.route.line).data})
            #'service': ServiceSerializer(result['vehicle_journey'].service).data})
            'journey_pattern': JourneyPatternSerializer(result['vehicle_journey'].journey_pattern).data})


    results_json['next'] = "%s?stop_id=%s&datetime_from=%s&nresults=%s&expand_journey=%s" % \
                           (reverse(journeys_by_time_and_stop), stop_id, quote(next_datetime.isoformat()), nresults,
                            request.GET.get('expand_journey', 'false'))
    return Response(results_json)


VehicleJourneyList_schema = AutoSchema(
    manual_fields=transport_pagination_fields + [
        coreapi.Field(
            "line",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to journeys whose 'line name' "
                            "is this. "
                            "(e.g. 'Universal U')"
                ),
            description="Limit results to journeys whose 'line name' "
                        "is this.",
            example="Universal U",
        ),
        coreapi.Field(
            "operator",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to journeys whose operator name "
                            "or operator code is this. "
                            "(e.g. 'Whippet Coaches' or 'WHIP')"
                ),
            description="Limit results to journeys whose operator name "
                        "or operator code is this.",
            example="Whippet Coaches",
        ),
    ]

)


class VehicleJourneyList(generics.ListAPIView):
    """
    Return a list of all known vehicle journeys.
    """
    queryset = VehicleJourney.objects.all().order_by('id')
    serializer_class = VehicleJourneySerializer
    pagination_class = Pagination
    schema = VehicleJourneyList_schema

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle

    def get_queryset(self):
        queryset = VehicleJourney.objects.all()
        line = self.request.query_params.get('line', None)
        if line is not None:
            queryset = queryset.filter(journey_pattern__route__line__line_name=line)
        operator = self.request.query_params.get('operator', None)
        if operator is not None:
            queryset = (queryset.filter(journey_pattern__route__line__operator__short_name=operator) |
                        queryset.filter(journey_pattern__route__line__operator__code=operator))
        return queryset


VehicleJourneyRetrieve_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "id",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Journey identifier (e.g. "
                            "'ea-20-PR2-_-y08-1-429-UL')"),
            description="Journey identifier (e.g. 'ea-20-PR2-_-y08-1-429-UL')",
            example="ea-20-PR2-_-y08-1-429-UL",
        ),
    ]
)


class VehicleJourneyRetrieve(generics.RetrieveAPIView):
    """
    Return information about the vehicle journey identified by _id_.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer
    schema = VehicleJourneyRetrieve_schema

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle


StopList_schema = AutoSchema(
    manual_fields=transport_stops_pagination_fields + [
        coreapi.Field(
            "bounding_box",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to stops within a bounding "
                            "box, specified as "
                            "'southwest_lng,southwest_lat,northeast_lng,"
                            "northeast_lat', "
                            "(e.g. '0.08,52.20,0.11,52.21')"
                ),
            description="Limit results to stops within a bounding "
                        "box, specified as "
                        "'southwest_lng,southwest_lat,northeast_lng,"
                        "northeast_lat', "
                        "(e.g. '0.08,52.20,0.11,52.21')"
        ),
        coreapi.Field(
            "search",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to stops that contain "
                            "this text somewhere within their stop_id, "
                            "common_name or locality_name fields "
                            "(e.g. 'madingley')"
                ),
            description="Limit results to stops that contain "
                        "this text somewhere within their stop_id, "
                        "common_name or locality_name fields "
                        "(e.g. 'madingley')"
        ),
        coreapi.Field(
            "ordering",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Field to sort results by. One of "
                            "'atco_code', 'common_name', or 'locality_name'."
                ),
            description="Field to sort results by. One of "
                        "'atco_code', 'common_name', or 'locality_name'."
        ),
    ]
)


class StopList(generics.ListAPIView):
    """
    Return a list of bus stops.
    """
    serializer_class = StopSerializer
    pagination_class = LongPagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    ordering_fields = ('atco_code', 'common_name', 'locality_name')
    ordering = ('atco_code', )
    search_fields = ('atco_code', 'common_name', 'locality_name')

    schema = StopList_schema
    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle

    def list(self, request, *args, **kwargs):
        # Retrieve the bounding box from the list of GET parameters
        bounding_box = self.request.query_params.get('bounding_box', None)
        if bounding_box is not None:
            match = re.match(r'^([^,]+),([^,]+),([^,]+),([^,]+)$', bounding_box)
            if match:
                try:
                    self.bounding_box = {
                        'west': float(match.group(1)),
                        'south': float(match.group(2)),
                        'east': float(match.group(3)),
                        'north': float(match.group(4))
                    }
                except ValueError:
                    return Response({"details": "bouding_box coordinates not "
                                     "properly formatted"}, status=500)
            else:
                return Response({"details": "bouding_box parameter not "
                                 "properly formatted"}, status=500)
        return super().list(self, request, *args, **kwargs)

    def get_queryset(self):
        try:
            # Returns a polygon object from the given bounding-box, a 4-tuple comprising (xmin, ymin, xmax, ymax).
            bounding_box = Polygon.from_bbox((self.bounding_box['west'], self.bounding_box['north'],
                                              self.bounding_box['east'], self.bounding_box['south']))
            return Stop.objects.filter(gis_location__contained=bounding_box)
        except AttributeError:
            return Stop.objects.all()


StopRetrieve_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "atco_code",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Stop atco_code (e.g. '0500CCITY111')"
                ),
            description="Stop atco_code (e.g. '0500CCITY111')",
            example="0500CCITY111",
        ),
    ]
)


class StopRetrieve(generics.RetrieveAPIView):
    """
    Return information about the bus stop identified by _atco_code_.
    """
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    schema = StopRetrieve_schema

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle
