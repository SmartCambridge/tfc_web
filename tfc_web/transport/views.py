import codecs
import requests
import json
from datetime import datetime, date
from urllib.request import urlopen
from django.conf import settings
from django.contrib.gis.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.views.generic import DetailView
from tfc_gis.models import Area
from transport.models import Stop, Line, Route, VehicleJourney, Timetable
from transport.utils.transxchange import timetable_from_service


def areas(request):
    return render(request, 'areas.html', {'areas': Area.objects.all()})


def area_home(request, area_id):
    return render(request, 'area-home.html', {'area': Area.objects.get(id=area_id)})


def map_real_time(request):
    return render(request, 'transport/map_real_time.html', {})


def bus_map_sirivm(request):
    return render(request, 'transport/routes_sirivm.html', {})


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

    bus_data = requests.get(settings.API_ENDPOINT+'/api/dataserver/feed/now/vix2').json() \
        if 'previous' not in request.GET else \
        requests.get(settings.API_ENDPOINT+'/api/dataserver/feed/previous/vix2').json()
    if boundaries_enabled:
        for index, bus in enumerate(bus_data['request_data']['entities']):
            if north > bus['latitude'] > south and west < bus['longitude'] < east:
                bus_list += [bus]
        bus_data['request_data']['entities'] = bus_list
    return JsonResponse(bus_data)


def bus_lines_list(request, area_id=None):
    if area_id:
        area = get_object_or_404(Area, id=area_id)
        bus_lines = Line.objects.filter(
            Q(routes__journey_patterns__section__timing_links__stop_from__gis_location__contained=area.poly) |
            Q(routes__journey_patterns__section__timing_links__stop_to__gis_location__contained=area.poly))\
            .order_by('line_name').distinct()
    else:
        bus_lines = Line.objects.all().order_by('line_name')
    return render(request, 'bus_lines_list.html', {'bus_lines': bus_lines})


def bus_line(request, bus_line_id):
    return render(request, 'bus_line.html', {'bus_line': Line.objects.get(id=bus_line_id)})


def bus_line_timetable(request, bus_line_id):
    bus_line = get_object_or_404(Line, id=bus_line_id)
    return render(request, 'bus_line_timetable.html', {'bus_line': bus_line,
                                                       'stop_list': bus_line.get_stop_list()})


def bus_route_map(request, bus_route_id):
    return render(request, 'bus_route_map.html', {'bus_route': Route.objects.get(id=bus_route_id)})


def bus_route_timetable_map(request, journey_id):
    return render(request, 'transport/bus_route_timetable_map.html', {'journey': VehicleJourney.objects.get(id=journey_id)})


def route_timetable_map(request, journey_id):
    return render(request, 'route_timetable_map.html', {'journey': VehicleJourney.objects.get(id=journey_id)})


def bus_stops_list(request, area_id=None):
    if area_id:
        area = get_object_or_404(Area, id=area_id)
        bus_stops = Stop.objects.filter(gis_location__contained=area.poly)
    else:
        bus_stops = Stop.objects.all()
    return render(request, 'bus_stops_list.html', {'bus_stops': bus_stops})


def bus_stop(request, bus_stop_id):
    bus_stop = get_object_or_404(Stop, atco_code=bus_stop_id)
    # timetable = Timetable.objects.filter(stop=bus_stop, time__gte=datetime.now(),
    #                                      vehicle_journey__days_of_week__contains=date.today().strftime("%A")) \
    #     .exclude(vehicle_journey__special_days_operation__days__contains=date.today(),
    #              vehicle_journey__special_days_operation__operates=False) \
    #     .select_related('vehicle_journey__journey_pattern__route__line').order_by('time')[:10]
    # This query uses too much load from Postgres, do this instead meanwhile
    query1 = Timetable.objects.filter(stop=bus_stop, time__gte=datetime.now(),
                                      vehicle_journey__days_of_week__contains=date.today().strftime("%A"))
    query2 = Timetable.objects.filter(vehicle_journey__id__in=query1.values_list('vehicle_journey', flat=True),
                                      vehicle_journey__special_days_operation__days__contains=date.today(),
                                      vehicle_journey__special_days_operation__operates=False)
    timetable = query1.difference(query2).prefetch_related('vehicle_journey__journey_pattern__route__line')\
                    .order_by('time')[:10]

    return render(request, 'bus_stop.html', {
        'bus_stop': bus_stop,
        'timetable': timetable,
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
        settings.API_ENDPOINT+'/api/dataserver/zone/list')))['request_data']['zone_list']
    return render(request, 'zones.html', {'zones': zones})


def zone(request, zone_id):
    reader = codecs.getreader("utf-8")
    zone = json.load(reader(urlopen(
        settings.API_ENDPOINT+'/api/dataserver/zone/config/%s' % zone_id)))['request_data']['options']['config']
    zone['name'] = zone['zone.name']
    zone['center'] = zone['zone.center']
    zone['zoom'] = zone['zone.zoom']
    zone['path'] = zone['zone.path']
    return render(request, 'zone.html', {
        'zone': zone,
        'tooltips_permanent': True,
        'mapcenter': "[%s, %s], %s" % (zone['center']['lat'], zone['center']['lng'], zone['zoom'])
    })


def vehicle_journey_real_time(request, vehicle_journey_id):
    vj = get_object_or_404(VehicleJourney, id=vehicle_journey_id)
    timetable = Timetable.objects.filter(vehicle_journey_id=vehicle_journey_id).select_related('stop').order_by('order')
    return render(request, 'transport/vjrt.html', {
        'vj': vj,
        'timetable': timetable
    })


class ServiceDetailView(DetailView):
    "A service and the stops it stops at"

    model = Line
    template_name = "transport/new_timetable.html"

    def get_context_data(self, **kwargs):
        context = super(ServiceDetailView, self).get_context_data(**kwargs)

        date = self.request.GET.get('date')
        if date:
            try:
                date = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                date = None
        if not date:
            date = timezone.now().date()
        context['timetables'] = timetable_from_service(self.object, date)

        if context.get('timetables'):
            for table in context['timetables']:
                table.groupings = [grouping for grouping in table.groupings if grouping.rows and grouping.rows[0].times]
                for grouping in table.groupings:
                    grouping.rows = [row for row in grouping.rows if any(row.times)]
                    stops_id = []
                    for row in grouping.rows:
                        stops_id.append(row.part.stop.atco_code)
                    stops_dict = {stop.pk: stop for stop in Stop.objects.filter(atco_code__in=stops_id)}
                    for row in grouping.rows:
                        row.part.stop.stop = stops_dict.get(row.part.stop.atco_code)


        # if not context.get('timetables'):
        #     context['stopusages'] = self.object.stopusage_set.all().select_related(
        #         'stop__locality'
        #     ).defer('stop__osm', 'stop__locality__latlong').order_by('direction', 'order')
        #     context['has_minor_stops'] = any(s.timing_status == 'OTH' for s in context['stopusages'])
        # else:
        #     stops_dict = {stop.pk: stop for stop in self.object.stops.all().select_related(
        #         'locality').defer('osm', 'latlong', 'locality__latlong')}
        #     for table in context['timetables']:
        #         table.groupings = [grouping for grouping in table.groupings if grouping.rows and grouping.rows[0].times]
        #         for grouping in table.groupings:
        #             grouping.rows = [row for row in grouping.rows if any(row.times)]
        #             for row in grouping.rows:
        #                 row.part.stop.stop = stops_dict.get(row.part.stop.atco_code)
        return context
