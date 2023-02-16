from datetime import datetime, date, timedelta, timezone
from django.conf import settings
from django.contrib.gis.geos import Polygon
from django.http import Http404
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.views.generic import DetailView
from django.urls import reverse
from smartpanel.views.smartpanel import smartpanel_settings
from transport.models import Stop, Line, Route, VehicleJourney
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
    return render(request, 'transport/bus_lines_list.html', {'bus_lines': bus_lines})


def bus_stops_map(request):
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


class ServiceDetailView(DetailView):
    "A service and the stops it stops at"

    model = Line
    template_name = "transport/new_timetable.html"

    def get_object(self, queryset=None):
        """
        Returns the object the view is displaying.
        By default this requires `self.queryset` and a `pk` or `slug` argument
        in the URLconf, but subclasses can override this to return any object.
        """
        # Use a custom queryset if provided; this is required for subclasses
        # like DateDetailView
        if queryset is None:
            queryset = self.get_queryset()
        # Next, try looking up by primary key.
        pk = self.kwargs.get(self.pk_url_kwarg)
        slug = self.kwargs.get(self.slug_url_kwarg)
        if pk is not None:
            queryset = queryset.filter(pk=pk)
        # Next, try looking up by slug.
        if slug is not None and (pk is None or self.query_pk_and_slug):
            slug_field = self.get_slug_field()
            queryset = queryset.filter(**{slug_field: slug})
        # If none of those are defined, it's an error.
        if pk is None and slug is None:
            raise AttributeError("Generic detail view %s must be called with "
                                 "either an object pk or a slug."
                                 % self.__class__.__name__)
        # Get the single item from the filtered queryset
        obj = queryset.first()
        if obj is None:
            raise Http404("No %(verbose_name)s found matching the query" %
                          {'verbose_name': queryset.model._meta.verbose_name})
        return obj

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

        try:
            context['timetables'] = timetable_from_service(self.object, date)
        except:
            raise Http404("No timetable found matching your query")

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


##############################
######## DEBUG VIEWS #########
##############################

# debug view
def bus_route_map(request, bus_route_id):
    bus_route = get_object_or_404(Route, id=bus_route_id)
    return render(request, 'transport/debug/bus_route_map.html', {'bus_route': bus_route})


# debug view
def bus_route_timetable_map(request, journey_id):
    journey = get_object_or_404(VehicleJourney, id=journey_id)
    return render(request, 'transport/debug/bus_route_timetable_map.html', {'journey': journey})


# debug view
def route_timetable_map(request, journey_id):
    journey = get_object_or_404(VehicleJourney, id=journey_id)
    return render(request, 'transport/debug/route_timetable_map.html', {'journey': journey})


# debug view
def bus_route_timetable(request, bus_route_id):
    bus_route = get_object_or_404(Route, id=bus_route_id)
    journeys = VehicleJourney.objects.filter(journey_pattern__route=bus_route).order_by('departure_time')
    return render(request, 'bus_route_timetable.html', {'bus_route': bus_route, 'journeys': journeys})
