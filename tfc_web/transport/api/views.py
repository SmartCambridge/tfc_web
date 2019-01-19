import json
import coreapi
import coreschema
from datetime import date, timedelta
from dateutil.parser import parse
from os import listdir
from pathlib import Path
from django.contrib.gis.geos import Polygon
from django.core.cache import cache
from django.urls import reverse
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, filters
from rest_framework.decorators import api_view, renderer_classes, schema, \
    parser_classes, authentication_classes, permission_classes, throttle_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import ManualSchema, AutoSchema
from transport.api.serializers import VehicleJourneySerializer, LineSerializer, \
    VehicleJourneySummarisedSerializer, StopSerializer
from transport.models import Stop, Timetable, VehicleJourney
from urllib.parse import quote
import re
from api.auth import default_authentication, default_permission, \
    default_throttle, AuthenticateddAPIView
from api.api_docs import transport_pagination_fields


DAYS = [ ['Monday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Tuesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Wednesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Thursday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Friday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Saturday', 'Weekend', 'MondayToSaturday', 'MondayToSunday'],
         ['Sunday', 'Weekend', 'MondayToSunday'] ]


class Pagination(PageNumberPagination):
    page_size = 25
    max_page_size = 50
    page_size_query_param = 'page_size'


class LongPagination(PageNumberPagination):
    page_size = 50
    max_page_size = 200
    page_size_query_param = 'page_size'


def string_to_datetime(str_time):
    try:
        time = parse(str_time)
    except:
        return None
    return time


def calculate_vehicle_journey(departure_time, departure_stop_id, destination_stop_id=None):
    """
    Retrieves a list of possible Vehicle Journeys from a departure time and a bus stop. Today is always used as
    the day the vehicle operates
    :param departure_time:
    :param bus_stop:
    :return: list of Vehicle Journeys
    """
    journey_day_of_week = departure_time.date().strftime("%A")
    query1 = Timetable.objects.filter(stop_id=departure_stop_id, time=departure_time.time(), order=1,
                                      vehicle_journey__days_of_week__contains=journey_day_of_week) \
        .values_list('vehicle_journey', flat=True)
    if destination_stop_id and len(query1) > 1:
        query1b = Timetable.objects.filter(stop_id=destination_stop_id, last_stop=True,
                                           vehicle_journey__days_of_week__contains=journey_day_of_week) \
            .values_list('vehicle_journey', flat=True)
        query1 = query1.intersection(query1b)
    query2 = VehicleJourney.objects.filter(
        id__in=query1, special_days_operation__days__contains=departure_time.date(),
        special_days_operation__operates=False).values_list('id', flat=True)
    return list(query1.difference(query2))


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

    query1 = Timetable.objects.filter(stop=stop, time__gte=datetime_from.time(),
                                      vehicle_journey__days_of_week__contains=datetime_from.strftime("%A"))
    query2 = Timetable.objects.filter(vehicle_journey__id__in=query1.values_list('vehicle_journey', flat=True),
                                      vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                                      vehicle_journey__special_days_operation__operates=False)
    # We fetch an extra entry to see if there are more than one bus leaving at the same hour,
    # to calculate next_datetime correctly
    timetable = list(query1.difference(query2).prefetch_related('vehicle_journey__journey_pattern__route__line')
                     .order_by('time')[:nresults+1])

    if len(timetable) < nresults:
        # no more results for the current day selected
        next_datetime = datetime_from.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    else:
        while timetable[-1].time == timetable[-2].time and len(timetable) > 2:
            # Remove from the result entries with the same leaving time
            timetable = timetable[:-1]
        if timetable[-1].time == timetable[-2].time and len(timetable) == 2:
            # Exceptional case where all entries have the same leaving time, in this case we return 0 results and
            # increase the nresult of the next query
            next_datetime = timetable[-1].time
            nresults += 1
            timetable = []
        else:
            # Remove the last entry that was only used to see if there are buses leaving at the same time
            next_datetime = timetable[-1].time
            timetable = timetable[:-1]

    results_json = {'results': []}
    for result in timetable:
        results_json['results'].append(
            {'time': result.time,
             'journey': VehicleJourneySummarisedSerializer(result.vehicle_journey).data
             if request.GET.get('expand_journey', 'false').lower() == 'true' else result.vehicle_journey.id,
             'line': LineSerializer(result.vehicle_journey.journey_pattern.route.line).data})

    results_json['next'] = "%s?stop_id=%s&datetime_from=%s&nresults=%s&expand_journey=%s" % \
                           (reverse(journeys_by_time_and_stop), stop_id, quote(next_datetime.isoformat()), nresults,
                            request.GET.get('expand_journey', 'false'))
    return Response(results_json)


departure_to_journey_schema = ManualSchema(
    fields=[
        coreapi.Field(
            "departure_stop_id",
            required=True,
            location="query",
            schema=coreschema.String(
                description="Departure stop atco_code - the first stop "
                            "of a journey (e.g. '0500CCITY544')"),
            description="Departure stop id atco_code - the first stop "
                        "of a journey (e.g. '0500CCITY544')",
            example="0500CCITY544",
        ),
        coreapi.Field(
            "departure_time",
            required=True,
            location="query",
            schema=coreschema.String(
                description="Departure datetime or time for returned "
                            "journeys. "
                            "If time is given instead of a datetime, "
                            "today is used as date. Defaults to now. "
                            "YYYY-MM-DDTHH:MM:SS or HH:MM:SS "
                            "(e.g. '2018-09-06T14:18:00')"),
            description="Departure datetime or time for returned journeys. "
                        "If time is given instead of a datetime, "
                        "today is used as date. Defaults to now. "
                        "YYYY-MM-DDTHH:MM:SS or HH:MM:SS "
                        "(e.g. '2018-09-06T14:18:00')",
            example="2018-09-06T14:18:00",
        ),
        coreapi.Field(
            "destination_stop_id",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Destination stop atco_code - the last stop "
                            "of a journey (e.g. '0500CCITY517')"),
            description="Destination stop atco_code - the last stop "
                        "of a journey (e.g. '0500CCITY517')",
            example="0500CCITY517",
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(
                description="Expands the resulting journey into a full "
                            "journey object"),
            description="Expands the resulting journey into a full "
                        "journey object"
        ),
    ],
    description="Using a departure stop identified by _departure_stop_id_ "
                "and a departure time identified by _departure_time_, "
                "and optionally a destination stop identified by "
                "_destination_stop_id_, return "
                "a list of timetabled vehicle journeys that match. "
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@authentication_classes(default_authentication)
@permission_classes(default_permission)
@throttle_classes(default_throttle)
@schema(departure_to_journey_schema)
def departure_to_journey(request):
    '''Using a Departure Stop and a Departure time tries to match it with a VehicleJourney.
    Returns the list of VehicleJourney that match.
    '''
    try:
        departure_stop_id = request.GET['departure_stop_id']
    except:
        return Response({"details": "departure_stop_id not present"}, status=400)
    try:
        departure_time = parse(request.GET['departure_time'])
    except:
        return Response({"details": "departure_time not present or has wrong format, has to be ISO"}, status=400)
    try:
        departure_stop = Stop.objects.get(atco_code=departure_stop_id)
    except:
        return Response({"details": "Departure Stop %s not found" % departure_stop_id}, status=404)
    destination_stop_id = request.GET.get('destination_stop_id', None)
    if destination_stop_id and not Stop.objects.filter(atco_code=destination_stop_id).exists():
        return Response({"details": "Destination Stop %s not found" % destination_stop_id}, status=404)
    vj_list = calculate_vehicle_journey(departure_time, departure_stop.atco_code, destination_stop_id)
    if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
        vj_list = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=vj_list), many=True).data
    return Response({'results': vj_list})


siriVM_POST_to_journey_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "body",
            required=True,
            location="body",
            type="application/json",
            schema=coreschema.String(description="siriVM data block"),
            description="siriVM data block"
        ),
    ]
)


@csrf_exempt
@api_view(['POST'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@authentication_classes(default_authentication)
@permission_classes(default_permission)
@throttle_classes(default_throttle)
@parser_classes((JSONParser,))
@schema(siriVM_POST_to_journey_schema)
def siriVM_POST_to_journey(request):
    '''Reads sirivm_data from the body of the request and returns it with
    matching vehicle journey data added to its entries'''
    try:
        jsondata = json.loads(request.body.decode("utf-8"))
        if jsondata.__class__ == str:
            jsondata = json.loads(jsondata)
    except Exception as e:
        return Response({"details": "JSON wrongly formatted: %s" % e}, status=500)
    if 'request_data' not in jsondata:
        return Response({"details": "missing request_data from json"}, status=400)
    try:
        for bus in jsondata['request_data']:
            bus['vehicle_journeys'] = \
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'],
                                          bus['DestinationRef'])
    except Exception as e:
        return Response({"details": "error while processing siriVM data: %s" % e}, status=500)
    return Response(jsondata)


# siriVM_to_journey_schema = ManualSchema(
#    fields = [
#        coreapi.Field(
#            "expand_journey",
#            required=False,
#            location="query",
#            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
#            description="Expands the resulted Journey into a full object"
#        ),
#    ],
#    description="Reads last data from siriVM feed and tries to match it with a VehicleJourney."
#)

@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@authentication_classes(default_authentication)
@permission_classes(default_permission)
@throttle_classes(default_throttle)
# hide from online documentation
@schema(None)
def siriVM_to_journey(request):
    """Reads last data from siriVM feed and tries to match it with a VehicleJourney

    get:
    returns the last data fro the siriVM feed and adds to each entry the corresponding vehicle_journey entry
    """
    try:
        real_time = json.loads(
            Path('/media/tfc/sirivm_json/data_monitor/' + listdir('/media/tfc/sirivm_json/data_monitor/')[0])
                .read_text())
    except:
        return Response({"details": "error while importing siriVM data json file"}, status=500)

    old_sirivm_cache_record = cache.get('sirivm_' + real_time['filename'])
    if old_sirivm_cache_record:
        return Response(old_sirivm_cache_record)

    try:
        for bus in real_time['request_data']:
            bus['vehicle_journeys'] = \
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'],
                                          bus['DestinationRef'])
            if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
                bus['vehicle_journeys'] = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=bus['vehicle_journeys']), many=True).data
    except:
        return Response({"details": "error while importing siriVM data json file"}, status=500)
    cache.set('sirivm_' + real_time['filename'], real_time, 60)
    return Response(real_time)


VehicleJourneyList_schema = AutoSchema(
    manual_fields=transport_pagination_fields
)


class VehicleJourneyList(generics.ListAPIView):
    """
    Return a list of all known vehicle journeys.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer
    pagination_class = Pagination
    schema = VehicleJourneyList_schema

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle


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
    manual_fields=transport_pagination_fields + [
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
            match = match = re.match(r'^([^,]+),([^,]+),([^,]+),([^,]+)$',
                                     bounding_box)
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
