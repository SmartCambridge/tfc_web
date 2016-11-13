import requests
from django.http import JsonResponse
from django.shortcuts import render
from realtime.models import BusStop


def home(request):
    return render(request, 'home.html', {})


def busdata_json(request):
    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json')
    return JsonResponse(bus_data.json())


def bus_stops_list(request):
    return render(request, 'bus_stops_list.html', {'bus_stops': BusStop.objects.all()})


def bus_stop(request, bus_stop_id):
    return render(request, 'bus_stop.html', {'bus_stop': BusStop.objects.get(atco_code=bus_stop_id)})
