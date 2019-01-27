from datetime import datetime, date, timedelta, timezone
from django.conf import settings
from django.contrib.gis.geos import Polygon
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.views.generic import DetailView
from django.urls import reverse
from smartpanel.views.smartpanel import smartpanel_settings
from transport.models import Stop, Line, Route, VehicleJourney, Timetable
from transport.utils.transxchange import timetable_from_service
from smartcambridge.decorator import smartcambridge_admin
from smartcambridge import rt_crypto


def map_real_time(request):
    # make an rt_token (defaults issued: now, duration: 1 hour, origin: smartcambridge servers, uses: 10000)
    rt_token = rt_crypto.rt_token(
        reverse("bus-map"),
        {
            "uses": "5",
            "duration": timedelta(minutes=60)
        }
    )
    return render(request, "transport/map_real_time.html", {
        "rt_token": rt_token,
        "RTMONITOR_URI": settings.RTMONITOR_URI
    })


def bus_lines_list(request):
    bus_lines = Line.objects.all().order_by('line_name')
    return render(request, 'bus_lines_list.html', {'bus_lines': bus_lines})


def bus_route_map(request, bus_route_id):
    return render(request, 'bus_route_map.html', {'bus_route': Route.objects.get(id=bus_route_id)})


def bus_route_timetable_map(request, journey_id):
    return render(request, 'transport/bus_route_timetable_map.html', {'journey': VehicleJourney.objects.get(id=journey_id)})


def route_timetable_map(request, journey_id):
    return render(request, 'route_timetable_map.html', {'journey': VehicleJourney.objects.get(id=journey_id)})


def bus_stops_list(request):
    area = Polygon.from_bbox((-0.11230006814002992, 52.29464119811643, 0.24690136313438418, 52.10594080364339))
    bus_stops = Stop.objects.filter(gis_location__contained=area)
    return render(request, 'transport/bus_stops_map.html', {'bus_stops': bus_stops, 'area': area[0],
                                                            'SMARTPANEL_API_ENDPOINT': settings.SMARTPANEL_API_ENDPOINT,
                                                            'SMARTPANEL_API_TOKEN': settings.SMARTPANEL_API_TOKEN})


def bus_stop(request, bus_stop_id):
    bus_stop = get_object_or_404(Stop, atco_code=bus_stop_id)

    # make an rt_token (defaults issued: now, duration: 0.5 hours, origin: smartcambridge servers, uses: 10000)
    rt_token = rt_crypto.rt_token(
        request.get_full_path(),
        {
            "uses": "5",
            "duration": timedelta(minutes=30)
        }
    )

    return render(request, 'transport/bus_stop_widget.html', {
        'bus_stop': bus_stop,
        'rt_token': rt_token,
        'RTMONITOR_URI': settings.RTMONITOR_URI,
        'settings': smartpanel_settings()})


def bus_route_timetable(request, bus_route_id):
    bus_route = Route.objects.get(id=bus_route_id)
    journeys = VehicleJourney.objects.filter(journey_pattern__route=bus_route).order_by('departure_time')
    return render(request, 'bus_route_timetable.html', {'bus_route': bus_route, 'journeys': journeys})

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

## Bus Analysis page
@smartcambridge_admin
def rtroute(request):
    # make an rt_token (defaults issued: now, duration: 1 hour, origin: smartcambridge servers, uses: 10000)
    rt_token = rt_crypto.rt_token( reverse("rtroute"), { "uses": "5", "duration": timedelta(minutes=60) } )

    return render(request,
                  "transport/rtroute.html",
                  { "rt_token": rt_token,
                    "RTMONITOR_URI": settings.RTMONITOR_URI
    })
