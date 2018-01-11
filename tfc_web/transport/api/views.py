import json
from datetime import date
from dateutil.parser import parse
from os import listdir
from pathlib import Path
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response
from transport.api.serializers import VehicleJourneySerializer
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


def string_to_time(str_time):
    try:
        time = parse(str_time).time()
    except:
        return None
    return time


def calculate_vehicle_journey(departure_time, bus_stop):
    """
    Retrieves a list of possible Vehicle Journeys from a departure time and a bus stop. Today is always used as
    the day the vehicle operates
    :param departure_time:
    :param bus_stop:
    :return: list of Vehicle Journeys
    """
    query1 = Timetable.objects.filter(stop_id=bus_stop, time=departure_time, order=1,
                                      vehicle_journey__days_of_week__contains=date.today().strftime("%A")) \
        .values_list('vehicle_journey', flat=True)
    query3 = VehicleJourney.objects.filter(
        id__in=query1, special_days_operation__days__contains=date.today(),
        special_days_operation__operates=False).values_list('id', flat=True)
    return list(query1.difference(query3))


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
def journeys_by_time_and_stop(request, stop_id):
    """This API will return the timetable expected for a given stop between two times (optional).
    Returns a list of Journeys given time_from and a stop (atco_code). Also accepts an optional time_to.

    get:
        `stop`: stop atco_code.
        `time_from:` [OPTIONAL] start time to give results, if not given now is used.
        `time_to`: [OPTIONAL] final time.
    """
    try:
        stop = Stop.objects.get(atco_code=stop_id)
    except:
        return Response({"details": "Stop not found"}, status=404)
    time_from = string_to_time(request.GET['time_from']) if request.GET['time_to'] else now().time()
    time_to = string_to_time(request.GET['time_to']) if request.GET['time_to'] else None
    if not time_from or not time_to:
        return Response({"details": "time_from or time_to badly formatted"}, status=400)
    kwargs_query = {"stop": stop, "time__gte": time_from}
    if time_to:
        kwargs_query["time__lte"] = time_to
    results = Timetable.objects.filter(**kwargs_query).select_related('stop', 'vehicle_journey')
    results_json = {'results': []}
    for result in results:
        results_json['results'].append({'stop': result.stop.atco_code, 'time': result.time,
                                        'vehicle_journey': result.vehicle_journey.id,
                                        'days_of_week': result.vehicle_journey.days_of_week})
    return Response(results_json)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
def stop_from_and_time_to_journey(request, stop_id):
    '''Using a Departure Stop and a Departure time tries to match it with a VehicleJourney.
    Returns the list of VehicleJourney that match.

    get:
        `departure_time`: [OPTIONAL] if empty, now is used.
        `stop_from`: stop atco_code.
    '''
    if 'stop_from' not in request.GET:
        return Response({"details": "missing stop_from parameter"}, status=400)
    try:
        stop_from = Stop.objects.get(atco_code=request.GET['stop_from'])
    except:
        return Response({"details": "Stop not found"}, status=404)
    time = string_to_time(request.GET['departure_time']) if request.GET['departure_time'] else now().time()
    return Response({'results': list(calculate_vehicle_journey(time, stop_from.atco_code))})


@csrf_exempt
@api_view(['POST'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
def siriVM_POST_to_journey(request):
    '''Reads sirivm_data from POST and adds VehicleJourney data to its entries'''
    if 'sirivm_data' not in request.POST:
        return Response({"details": "missing sirivm_data from POST"}, status=400)
    try:
        real_time = json.loads(request.POST['sirivm_data'])
    except:
        return Response({"details": "JSON error in siriVM data"}, status=500)
    try:
        for bus in real_time['request_data']:
            bus['vehicle_journeys'] = calculate_vehicle_journey(string_to_time(bus['OriginAimedDepartureTime']),
                                                                bus['OriginRef'])
    except:
        return Response({"details": "error while processing siriVM data"}, status=500)
    return Response(real_time)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
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
            bus['vehicle_journeys'] = calculate_vehicle_journey(string_to_time(bus['OriginAimedDepartureTime']),
                                                                bus['OriginRef'])
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

