import datetime
from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible


class Stop(models.Model):
    atco_code = models.CharField(max_length=12, unique=True, primary_key=True)
    naptan_code = models.CharField(max_length=12)
    plate_code = models.CharField(max_length=10)
    cleardown_code = models.CharField(max_length=10)
    common_name = models.CharField(max_length=64)
    common_name_lang = models.CharField(max_length=2)
    short_common_name = models.CharField(max_length=64)
    short_common_name_lang = models.CharField(max_length=2)
    landmark = models.CharField(max_length=64)
    landmark_lang = models.CharField(max_length=2)
    street = models.CharField(max_length=64)
    street_lang = models.CharField(max_length=2)
    crossing = models.CharField(max_length=64)
    crossing_lang = models.CharField(max_length=2)
    indicator = models.CharField(max_length=64)
    indicator_lang = models.CharField(max_length=2)
    bearing = models.CharField(max_length=2)
    nptg_locality_code = models.CharField(max_length=12)
    locality_name = models.CharField(max_length=64)
    parent_locality_name = models.CharField(max_length=64)
    grand_parent_locality_name = models.CharField(max_length=64)
    town = models.CharField(max_length=64)
    town_lang = models.CharField(max_length=2)
    suburb = models.CharField(max_length=64)
    suburb_lang = models.CharField(max_length=2)
    locality_centre = models.BooleanField()
    grid_type = models.CharField(max_length=1)
    easting = models.IntegerField()
    northing = models.IntegerField()
    longitude = models.FloatField()
    latitude = models.FloatField()
    gis_location = models.PointField(null=True)
    stop_type = models.CharField(max_length=3)
    bus_stop_type = models.CharField(max_length=3)
    timing_status = models.CharField(max_length=3)
    default_wait_time = models.IntegerField(null=True, blank=True)
    notes = models.CharField(max_length=255)
    notes_lang = models.CharField(max_length=2)
    administrative_area_code = models.IntegerField()
    creation_datetime = models.DateTimeField()
    modification_datetime = models.DateTimeField()
    revision_number = models.IntegerField()
    modification = models.CharField(max_length=3)
    status = models.CharField(max_length=3)
    objects = models.GeoManager()

    def get_coordinates(self):
        return [self.latitude, self.longitude]

    @python_2_unicode_compatible
    def __str__(self):
        return "%s, %s %s" % (self.locality_name, self.indicator, self.common_name)


@receiver(pre_save, sender=Stop)
def update_gis_fields(sender, instance, **kwargs):
    instance.gis_location = Point(float(instance.longitude), float(instance.latitude))


class Operator(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    code = models.CharField(max_length=255)
    short_name = models.CharField(max_length=255)
    trading_name = models.CharField(max_length=255)

    @python_2_unicode_compatible
    def __str__(self):
        return self.trading_name


class Line(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    line_name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    operator = models.ForeignKey(Operator, related_name="lines")
    standard_origin = models.CharField(max_length=255)
    standard_destination = models.CharField(max_length=255)
    regular_days_of_week = models.CharField(max_length=255, null=True)
    bank_holiday_operation = models.CharField(max_length=255, null=True)
    start_date = models.DateField(null=True)
    end_date = models.DateField(null=True)

    def get_all_vehicle_journeys(self):
        journeys = []
        for route in self.routes.all():
            for jp in route.journey_patterns.all():
                for journey in jp.journeys.all():
                    journeys.append(journey)
        return journeys

    @python_2_unicode_compatible
    def __str__(self):
        return "%s (%s)" % (self.line_name, self.description)


class Route(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    description = models.CharField(max_length=255)
    line = models.ForeignKey(Line, related_name='routes')
    stops_list = models.TextField()

    def get_stops_list(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(Stop.objects.get(atco_code=stop))
        return bus_stops

    def get_route_coordinates(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(Stop.objects.get(atco_code=stop).get_coordinates())
        return bus_stops

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.line, self.description)


class JourneyPatternSection(models.Model):
    id = models.CharField(max_length=255, primary_key=True)

    def get_stops_list(self):
        bus_stops = []
        timing_links = self.timing_link.order_by('stop_from_sequence_number')
        for timing_link in timing_links:
            bus_stops.append(timing_link.stop_from)
        bus_stops.append(timing_links.last().stop_to)
        return bus_stops

    @python_2_unicode_compatible
    def __str__(self):
        return "%s" % (self.id)


class JourneyPatternTimingLink(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    stop_from = models.ForeignKey(Stop, related_name='departure_journeys')
    stop_from_timing_status = models.CharField(max_length=3)
    stop_from_sequence_number = models.IntegerField()
    stop_to = models.ForeignKey(Stop, related_name='arrival_journeys')
    stop_to_timing_status = models.CharField(max_length=3)
    stop_to_sequence_number = models.IntegerField()
    run_time = models.DurationField()
    wait_time = models.DurationField(null=True, blank=True)
    journey_pattern_section = models.ForeignKey(JourneyPatternSection, related_name='timing_links')

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s (%s)" % (self.stop_from, self.stop_to, self.runtime)


class JourneyPattern(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    route = models.ForeignKey(Route, related_name='journey_patterns')
    direction = models.CharField(max_length=100)
    section = models.ForeignKey(JourneyPatternSection, related_name='journey_patterns')

    def departure_times(self):
        return self.journeys.order_by("departure_time").values_list("departure_time", flat=True)

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.section, self.route)


class VehicleJourney(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    journey_pattern = models.ForeignKey(JourneyPattern, related_name='journeys')
    departure_time = models.CharField(max_length=20)
    days_of_week = models.CharField(max_length=100, null=True)

    def get_timetable(self):
        timetable = []
        departure_time = datetime.datetime.strptime(self.departure_time, '%H:%M:%S')
        timing_links = self.journey_pattern.section.timing_links.order_by('stop_from_sequence_number')
        for timing_link in timing_links:
            timetable.append({'time': departure_time.time(), 'stop': timing_link.stop_from})
            departure_time += timing_link.run_time
            if timing_link.wait_time:
                departure_time += timing_link.wait_time
        timetable.append({'time': departure_time.time(), 'stop': timing_links.last().stop_to})
        return timetable

    def get_timetable_stops(self):
        timetable = []
        departure_time = datetime.datetime.strptime(self.departure_time, '%H:%M:%S')
        timing_links = self.journey_pattern.section.timing_links.order_by('stop_from_sequence_number')
        for timing_link in timing_links:
            timetable.append({'time': departure_time.time(), 'latitude': timing_link.stop_from.latitude,
                              'longitude': timing_link.stop_from.longitude})
            departure_time += timing_link.run_time
            if timing_link.wait_time:
                departure_time += timing_link.wait_time
        timetable.append({'time': departure_time.time(), 'latitude': timing_links.last().stop_to.latitude,
                          'longitude': timing_links.last().stop_to.longitude})
        return timetable

    def get_stops_list(self):
        return self.journey_pattern.section.get_stops_list()

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.journey_pattern.route, self.departure_time)
