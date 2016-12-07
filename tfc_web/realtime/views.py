import codecs
import requests
import json
from urllib.request import urlopen
from django.http import JsonResponse
from django.shortcuts import render
from realtime.models import BusStop
from vix.models import Route, Stop


def index(request):
    return render(request, 'home.html', {})


def bus_map(request):
    return render(request, 'bus_map_move.html', {})


def busdata_json(request):
    if 'north' in request.GET and 'south' in request.GET and 'east' in request.GET and 'west' in request.GET:
        north = float(request.GET['north'])
        south = float(request.GET['south'])
        east = float(request.GET['east'])
        west = float(request.GET['west'])
        boundaries_enabled = True
        bus_list = []
        if 'border' in request.GET and request.GET['border'] is "true":
            extra1 = (north - south)/2
            north += extra1
            south -= extra1
            extra2 = (west - east)/2
            west += extra2
            east -= extra2
    else:
        boundaries_enabled = False

    bus_data = requests.get('http://smartcambridge.org/backdoor/dataserver/raw/file/monitor_json/post_data.json').json()
    if boundaries_enabled:
        for index, bus in enumerate(bus_data['entities']):
            if north > bus['latitude'] > south and west < bus['longitude'] < east:
                bus_list += [bus]
        bus_data['entities'] = bus_list
    for index, bus in enumerate(bus_data['entities']):
        if 'stop_id' in bus:
            stop = Stop.objects.filter(id=bus['stop_id'])
            if stop:
                bus_data['entities'][index]['stop'] = stop.values("code", "name")[0]
        if 'route_id' in bus:
            route = Route.objects.filter(id=bus['route_id'])
            if route:
                bus_data['entities'][index]['route'] = route.values("long_name", "short_name", "agency__name")[0]
    return JsonResponse(bus_data)


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
