import json
from datetime import date
from dateutil.parser import parse
from django.http import HttpResponse, JsonResponse
from os import listdir
from pathlib import Path

from django.views.decorators.csrf import csrf_exempt

from transport.models import Stop, Timetable, VehicleJourney


DAYS = [ ['Monday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Tuesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Wednesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Thursday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Friday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Saturday', 'Weekend', 'MondayToSaturday', 'MondayToSunday'],
         ['Sunday', 'Weekend', 'MondayToSunday'] ]


def string_to_time(str_time):
    try:
        time = parse(str_time).time()
    except:
        return None
    return time


def journeys_by_time_and_stop(request):
    if request.method != "GET":
        return HttpResponse(status=405, reason="only GET is allowed")
    if 'stop' not in request.GET or 'time_from' not in request.GET or 'time_to' not in request.GET:
        return HttpResponse(status=400, reason="missing stop, time_from, or time_to from GET")
    stop = Stop.objects.filter(atco_code=request.GET['stop'])
    if not stop:
        return HttpResponse(status=404, reason="Stop not found")
    time_from = string_to_time(request.GET['time_from'])
    time_to = string_to_time(request.GET['time_to'])
    if not time_from or not time_to:
        return HttpResponse(status=400, reason="time_from badly formatted")
    results = Timetable.objects.filter(stop=stop, time__gte=time_from, time__lte=time_to) \
        .select_related('stop', 'vehicle_journey')
    results_json = {'results': []}
    for result in results:
        results_json['results'].append({'stop': result.stop.atco_code, 'time': result.time,
                                        'vehicle_journey': result.vehicle_journey.id,
                                        'days_of_week': result.vehicle_journey.days_of_week})
    return JsonResponse(results_json, json_dumps_params={'indent': 2})


def stop_from_and_time_to_journey(request):
    '''Using a Departure Stop and a Departure time tries to match it with a VehicleJourney.
    Returns the list of VehicleJourney that match'''
    if request.method != "GET":
        return HttpResponse(status=405, reason="only GET is allowed")
    if 'stop_from' not in request.GET or 'departure_time' not in request.GET:
        return HttpResponse(status=400, reason="missing stop_from, or departure_time from GET")
    stop_from = Stop.objects.filter(atco_code=request.GET['stop_from'])
    if not stop_from:
        return HttpResponse(status=404, reason="Stop not found")
    time = string_to_time(request.GET['departure_time'])
    if not time:
        return HttpResponse(status=400, reason="time_from badly formatted")
    results = Timetable.objects.filter(stop=stop_from, time=time, order=1).values_list('vehicle_journey', flat=True)
    return JsonResponse({'results': list(results)}, json_dumps_params={'indent': 2})


@csrf_exempt
def siriVM_POST_to_journey(request):
    '''Reads siriVM data from POST and tries to match it with a VehicleJourney'''
    if request.method != "POST":
        return HttpResponse(status=405, reason="only POST is allowed")
    if 'sirivm_data' not in request.POST:
        return HttpResponse(status=400, reason="missing sirivm_data from POST")
    try:
        real_time = json.loads(request.POST['sirivm_data'])
    except:
        return HttpResponse(status=500, reason="JSON error in siriVM data")
    try:
        for bus in real_time['request_data']:
            time = string_to_time(bus['OriginAimedDepartureTime'])
            query1 = Timetable.objects.filter(stop_id=bus['OriginRef'], time=time, order=1,
                                              vehicle_journey__days_of_week__contains=date.today().strftime("%A"))\
                .values_list('vehicle_journey', flat=True)
            query3 = VehicleJourney.objects.filter(
                id__in=query1, special_days_operation__days__contains=date.today(),
                special_days_operation__operates=False).values_list('id', flat=True)
            bus['vehicle_journeys'] = list(query1.difference(query3))
    except:
        return HttpResponse(status=500, reason="error while processing siriVM data")
    return JsonResponse(real_time, json_dumps_params={'indent': 2})


def siriVM_to_journey(request):
    '''Reads last data from siriVM feed and tries to match it with a VehicleJourney'''
    try:
        real_time = json.loads(
            Path('/media/tfc/sirivm_json/data_monitor/' + listdir('/media/tfc/sirivm_json/data_monitor/')[0])
                .read_text())
    except:
        return HttpResponse(status=500, reason="error while importing siriVM data json file")

    try:
        for bus in real_time['request_data']:
            time = string_to_time(bus['OriginAimedDepartureTime'])
            # query1 = Timetable.objects.filter(stop_id=bus['OriginRef'], time=time, order=1,
            #                                   vehicle_journey__days_of_week__contains=date.today().strftime("%A"))\
            #     .values_list('vehicle_journey', flat=True)
            # query2 = Timetable.objects.filter(stop_id=bus['DestinationRef'], last_stop=True,
            #                                   vehicle_journey__days_of_week__contains=date.today().strftime("%A"))\
            #     .values_list('vehicle_journey', flat=True)
            # temp = query1.intersection(query2)
            # query3 = VehicleJourney.objects.filter(
            #     id__in=temp, special_days_operation__days__contains=date.today(),
            #     special_days_operation__operates=False).values_list('id', flat=True)
            # bus['vehicle_journeys'] = list(temp.difference(query3))
            query1 = Timetable.objects.filter(stop_id=bus['OriginRef'], time=time, order=1,
                                              vehicle_journey__days_of_week__contains=date.today().strftime("%A"))\
                .values_list('vehicle_journey', flat=True)
            query3 = VehicleJourney.objects.filter(
                id__in=query1, special_days_operation__days__contains=date.today(),
                special_days_operation__operates=False).values_list('id', flat=True)
            bus['vehicle_journeys'] = list(query1.difference(query3))
    except:
        return HttpResponse(status=500, reason="error while importing siriVM data json file")

    return JsonResponse(real_time, json_dumps_params={'indent': 2})


def journey_id_to_journey(request):
    '''Returns the journey object based on it's id'''
    if request.method != "GET":
        return HttpResponse(status=405, reason="only GET is allowed")
    if 'vehicle_journey_id' not in request.GET:
        return HttpResponse(status=400, reason="missing vehicle_journey_id from GET")
    try:
        vehicle_journey = VehicleJourney.objects.get(id=request.GET['vehicle_journey_id'])
    except:
        return HttpResponse(status=404, reason="VehicleJourney not found")
    return JsonResponse({'results': {'id': vehicle_journey.id, 'days_of_week': vehicle_journey.days_of_week,
                                     'timetable': vehicle_journey.timetable} }, json_dumps_params={'indent': 2})
