import codecs
import requests
import json
from urllib.request import urlopen
from django.http import JsonResponse
from django.shortcuts import render
from realtime.models import BusStop


def index(request):
    return render(request, 'home.html', {})


def bus_map(request):
    return render(request, 'bus_map_move.html', {})


def busdata_json(request):
    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json')
    return JsonResponse(bus_data.json())


def bus_stops_list(request):
    return render(request, 'bus_stops_list.html', {'bus_stops': BusStop.objects.all()})


def bus_stop(request, bus_stop_id):
    return render(request, 'bus_stop.html', {'bus_stop': BusStop.objects.get(atco_code=bus_stop_id)})


def zones_list(request):
    reader = codecs.getreader("utf-8")
    zones = json.load(reader(urlopen(
        'http://smartcambridge.org/api/dataserver/zone/list')))['request_data']['zone_list']
    return render(request, 'zones.html', {'zones': zones})


def zone(request, zone_id):
    reader = codecs.getreader("utf-8")
    zone = json.load(reader(urlopen(
        'http://smartcambridge.org/api/dataserver/zone/config/%s' % zone_id)))['request_data']['options']['config']
    zone['name'] = zone['zone.name']
    zone['center'] = zone['zone.center']
    zone['zoom'] = zone['zone.zoom']
    zone['path'] = zone['zone.path']
    return render(request, 'zone.html', {'zone': zone})
