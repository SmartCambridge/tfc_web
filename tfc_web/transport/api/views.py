import json
from datetime import date
import coreapi
import coreschema
from dateutil.parser import parse
from os import listdir
from pathlib import Path
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics
from rest_framework.decorators import api_view, renderer_classes, schema, parser_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import ManualSchema, AutoSchema
from transport.api.serializers import VehicleJourneySerializer, LineSerializer, \
    VehicleJourneySummarisedSerializer, StopSerializer
from transport.models import Stop, Timetable, VehicleJourney


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


def string_to_datetime(str_time):
    try:
        time = parse(str_time)
    except:
        return None
    return time


def calculate_vehicle_journey(departure_time, bus_stop_id):
    """
    Retrieves a list of possible Vehicle Journeys from a departure time and a bus stop. Today is always used as
    the day the vehicle operates
    :param departure_time:
    :param bus_stop:
    :return: list of Vehicle Journeys
    """
    query1 = Timetable.objects.filter(stop_id=bus_stop_id, time=departure_time.time(), order=1,
                                      vehicle_journey__days_of_week__contains=departure_time.date().strftime("%A")) \
        .values_list('vehicle_journey', flat=True)
    query2 = VehicleJourney.objects.filter(
        id__in=query1, special_days_operation__days__contains=departure_time.date(),
        special_days_operation__operates=False).values_list('id', flat=True)
    return list(query1.difference(query2))


journeys_by_time_and_stop_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "stop_id",
            required=True,
            location="query",
            schema=coreschema.String(description="Stop id atco_code."),
            description="Stop atco_code."
        ),
        coreapi.Field(
            "datetime_from",
            required=False,
            location="query",
            schema=coreschema.String(description="Start datetime or time to give results from. "
                                                 "If time is given insetad of a datetime, "
                                                 "today is used as date. If nothing given, "
                                                 "now is used. The datetime or date must be "
                                                 "given in ISO 8601 format."),
            description="Start datetime or time to give results from. If time is given insetad "
                        "of a datetime, today is used as date. If nothing given, now is used. "
                        "The datetime or date must be given in ISO 8601 format."
        ),
        coreapi.Field(
            "nresults",
            required=False,
            location="query",
            schema=coreschema.Integer(description="Maximum number of journeys to return"),
            description="Maximum number of journeys to return."
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Exdpands the resulted Journey into a full object"
        ),
    ],
    description="Will return the timetable expected for a given stop from a specific time ("
                "optional). Returns a list of Journeys given datetime_from and a stop_id ("
                "atco_code)."
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
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
        nresults = int(request.GET['nresults']) if 'nresults' in request.GET else None
    except:
        return Response({"details": "nresults is not an int"}, status=400)

    query1 = Timetable.objects.filter(stop=stop, time__gte=datetime_from.time(),
                                      vehicle_journey__days_of_week__contains=datetime_from.strftime("%A"))
    query2 = Timetable.objects.filter(vehicle_journey__id__in=query1.values_list('vehicle_journey', flat=True),
                                      vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                                      vehicle_journey__special_days_operation__operates=False)
    timetable = query1.difference(query2).prefetch_related('vehicle_journey__journey_pattern__route__line')\
                    .order_by('time')

    if nresults:
        timetable = timetable[:nresults]

    results_json = {'results': []}
    for result in timetable:
        results_json['results'].append(
            {'time': result.time,
             'journey': VehicleJourneySummarisedSerializer(result.vehicle_journey).data
             if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true'
             else result.vehicle_journey.id,
             'line': LineSerializer(result.vehicle_journey.journey_pattern.route.line).data})
    return Response(results_json)


departure_to_journey_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "departure_stop_id",
            required=True,
            location="query",
            schema=coreschema.String(description="Departure Stop atco_code. First stop of a Journey."),
            description="Departure Stop atco_code. First stop of a Journey."
        ),
        coreapi.Field(
            "departure_time",
            required=True,
            location="query",
            schema=coreschema.String(description="Departure datetime or time. "
                                                 "The date or time when the Journey starts. "
                                                 "If time is given insetad of a datetime, today is used as date. "
                                                 "The datetime or date must be given in ISO 8601 format."),
            description="Departure datetime or time. The date or time when the Journey starts. "
                        "If time is given insetad of a datetime, today is used as date. "
                        "The datetime or date must be given in ISO 8601 format."
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Exdpands the resulted Journey into a full object"
        ),
    ],
    description="Using a Departure Stop and a Departure time tries to match it with a VehicleJourney. "
                "Returns the list of VehicleJourney that match."
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
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
        return Response({"details": "Stop %s not found" % departure_stop_id}, status=404)
    vj_list = calculate_vehicle_journey(departure_time, departure_stop.atco_code)
    if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
        vj_list = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=vj_list), many=True).data
    return Response({'results': vj_list})


siriVM_POST_to_journey_schema = AutoSchema(
    manual_fields = [
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
@parser_classes((JSONParser,))
@schema(siriVM_POST_to_journey_schema)
def siriVM_POST_to_journey(request):
    '''Reads sirivm_data from POST and adds VehicleJourney data to its entries'''
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
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'])
    except Exception as e:
        return Response({"details": "error while processing siriVM data: %s" % e}, status=500)
    return Response(jsondata)


siriVM_to_journey_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Expands the resulted Journey into a full object"
        ),
    ],
    description="Reads last data from siriVM feed and tries to match it with a VehicleJourney."
)

@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@schema(siriVM_to_journey_schema)
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

    try:
        for bus in real_time['request_data']:
            bus['vehicle_journeys'] = \
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'])
            if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
                bus['vehicle_journeys'] = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=bus['vehicle_journeys']), many=True).data
    except:
        return Response({"details": "error while importing siriVM data json file"}, status=500)
    return Response(real_time)


class VehicleJourneyList(generics.ListAPIView):
    """
    Return a list of all the existing VehicleJourney.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer
    pagination_class = Pagination


class VehicleJourneyRetrieve(generics.RetrieveAPIView):
    """
    Return the VehicleJourney corresponding to the given id.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer


class StopList(generics.ListAPIView):
    """
    Return a list of all the existing Stops.
    """
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
    pagination_class = Pagination


class StopRetrieve(generics.RetrieveAPIView):
    """
    Return the Stop corresponding to the given id (atco_code).
    """
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
