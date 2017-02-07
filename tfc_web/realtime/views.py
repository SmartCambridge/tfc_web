import codecs
import requests
import json
from urllib.request import urlopen
from django.http import JsonResponse
from django.shortcuts import render
from realtime.models import Stop, Line, Route, VehicleJourney, JourneyPatternTimingLink, JourneyPatternSection
from vix.models import Route as VixRoute, Stop as VixStop


def index(request):
    return render(request, 'home.html', {})


def bus_map(request):
    return render(request, 'routes.html', {})


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
            extra2 = (east - west)/2
            west -= extra2
            east += extra2
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
            stop = VixStop.objects.filter(id=bus['stop_id'])
            if stop:
                bus_data['entities'][index]['stop'] = stop.values("code", "name")[0]
        if 'route_id' in bus:
            route = VixRoute.objects.filter(id=bus['route_id'])
            if route:
                bus_data['entities'][index]['route'] = route.values("long_name", "short_name", "agency__name")[0]
    return JsonResponse(bus_data)


def bus_lines_list(request):
    return render(request, 'bus_lines_list.html', {'bus_lines': Line.objects.all()})


def bus_line(request, bus_line_id):
    return render(request, 'bus_line.html', {'bus_line': Line.objects.get(id=bus_line_id)})


def bus_route_map(request, bus_route_id):
    return render(request, 'bus_route_map.html', {'bus_route': Route.objects.get(id=bus_route_id)})


def bus_route_timetable_map(request, journey_id):
    return render(request, 'bus_route_timetable_map.html', {'journey': VehicleJourney.objects.get(id=journey_id)})


def bus_stops_list(request):
    return render(request, 'bus_stops_list.html', {'bus_stops': Stop.objects.all()})


def bus_stop(request, bus_stop_id):
    bus_stop = Stop.objects.get(atco_code=bus_stop_id)
    return render(request, 'bus_stop.html', {
        'bus_stop': bus_stop,
        'tooltips_permanent': True,
        'mapcenter': "[%s, %s], 16" % (bus_stop.latitude, bus_stop.longitude)
    })


def bus_route_timetable(request, bus_route_id):
    bus_route = Route.objects.get(id=bus_route_id)
    journeys = VehicleJourney.objects.filter(journey_pattern__route=bus_route).order_by('departure_time')
    return render(request, 'bus_route_timetable.html', {'bus_route': bus_route, 'journeys': journeys})


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
    return render(request, 'zone.html', {
        'zone': zone,
        'tooltips_permanent': True,
        'mapcenter': "[%s, %s], %s" % (zone['center']['lat'], zone['center']['lng'], zone['zoom'])
    })
