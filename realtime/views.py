import requests
from django.http import JsonResponse
from django.shortcuts import render


def home(request):
    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json')
    bus_data_json = bus_data.json()

    return render(request, 'home.html', {
        'bus_locations': bus_data_json,
    })


def busdata_json(request):
    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json')
    return JsonResponse(bus_data.json())

