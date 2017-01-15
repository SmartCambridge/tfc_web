from django.db import models
from django.utils.encoding import python_2_unicode_compatible


class BusStop(models.Model):
    atco_code = models.CharField(max_length=12)
    naptan_code = models.CharField(max_length=8)
    plate_code = models.CharField(max_length=10)
    cleardown_code = models.CharField(max_length=10)
    common_name = models.CharField(max_length=64)
    common_name_lang = models.CharField(max_length=2)
    short_common_name = models.CharField(max_length=21)
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
    nptg_locality_code = models.CharField(max_length=8)
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

    def get_coordinates(self):
        return [self.latitude, self.longitude]


class BusOperator(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    code = models.CharField(max_length=255)
    short_name = models.CharField(max_length=255)
    trading_name = models.CharField(max_length=255)

    @python_2_unicode_compatible
    def __str__(self):
        return self.trading_name


class BusLine(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    line_name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    operator = models.ForeignKey(BusOperator, related_name="lines")
    standard_origin = models.CharField(max_length=255)
    standard_destination = models.CharField(max_length=255)

    @python_2_unicode_compatible
    def __str__(self):
        return "%s (%s)" % (self.line_name, self.description)


class BusRoute(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    description = models.CharField(max_length=255)
    line = models.ForeignKey(BusLine, related_name='routes')
    stops_list = models.TextField()

    def get_stops_list(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(BusStop.objects.get(atco_code=stop))
        return bus_stops

    def get_route_coordinates(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(BusStop.objects.get(atco_code=stop).get_coordinates())
        return bus_stops

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.line, self.description)


class BusJourneyPatternSection(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    line = models.ForeignKey(BusLine, related_name='journey_sections')
    stops_list = models.TextField()

    def get_stops_list(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(BusStop.objects.get(atco_code=stop))
        return bus_stops

    def get_journey_coordinates(self):
        bus_stops = []
        for stop in self.stops_list.split(','):
            bus_stops.append(BusStop.objects.get(atco_code=stop).get_coordinates())
        return bus_stops

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.line, self.id)


class BusJourneyPattern(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    route = models.ForeignKey(BusRoute, related_name='journey_patterns')
    direction = models.CharField(max_length=100)
    section = models.ForeignKey(BusJourneyPatternSection, related_name='journey_patterns')


class BusJourney(models.Model):
    id = models.CharField(max_length=255, primary_key=True)
    line = models.ForeignKey(BusLine, related_name='journeys')
    pattern = models.ForeignKey(BusJourneyPattern, related_name='journeys')
    departure_time = models.CharField(max_length=20)
