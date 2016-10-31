import requests
from django.http import JsonResponse
from django.shortcuts import render


def home(request):
    return render(request, 'home.html', {})


def busdata_json(request):
    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json')
    return JsonResponse(bus_data.json())

