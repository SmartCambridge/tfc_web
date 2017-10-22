import datetime
from django.http import HttpResponse, JsonResponse
from transport.models import Stop, Timetable


def string_to_time(str_time):
    try:
        time = datetime.datetime.strptime(str_time, '%H:%M:%S.%f').time()
    except:
        try:
            time = datetime.datetime.strptime(str_time, '%H:%M:%S').time()
        except:
            try:
                time = datetime.datetime.strptime(str_time, '%H:%M').time()
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
    return JsonResponse(results_json)


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
    time = string_to_time(request.GET['time'])
    if not time:
        return HttpResponse(status=400, reason="time_from badly formatted")
    results = Timetable.objects.filter(stop=stop_from, time=time, order=1).values_list('vehicle_journey', flat=True)
    return JsonResponse({'results': list(results)})


