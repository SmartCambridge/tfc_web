import datetime
from django.http import HttpResponse, JsonResponse
from transport.models import Stop, Timetable


def journeys_by_time_and_stop(request):
    if request.method != "GET":
        return HttpResponse(status=405, reason="only GET is allowed")
    if 'stop' not in request.GET or 'time_from' not in request.GET or 'time_to' not in request.GET:
        return HttpResponse(status=400, reason="missing stop, time_from, or time_to from GET")
    stop = Stop.objects.filter(atco_code=request.GET['stop'])
    if not stop:
        return HttpResponse(status=404)  # Not found
    try:
        time_from = datetime.datetime.strptime(request.GET['time_from'], '%H:%M:%S.%f').time()
    except:
        try:
            time_from = datetime.datetime.strptime(request.GET['time_from'], '%H:%M:%S').time()
        except:
            try:
                time_from = datetime.datetime.strptime(request.GET['time_from'], '%H:%M').time()
            except:
                return HttpResponse(status=400, reason="time_from badly formated")
    try:
        time_to = datetime.datetime.strptime(request.GET['time_to'], '%H:%M:%S.%f').time()
    except:
        try:
            time_to = datetime.datetime.strptime(request.GET['time_to'], '%H:%M:%S').time()
        except:
            try:
                time_to = datetime.datetime.strptime(request.GET['time_to'], '%H:%M').time()
            except:
                return HttpResponse(status=400, reason="time_to badly formated")
    results = Timetable.objects.filter(stop=stop, time__gte=time_from, time__lte=time_to) \
        .select_related('stop', 'vehicle_journey')
    results_json = {'results': []}
    for result in results:
        results_json['results'].append({'stop': result.stop.atco_code, 'time': result.time,
                                        'vehicle_journey': result.vehicle_journey.id})
    return JsonResponse(results_json)
