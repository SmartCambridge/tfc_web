import datetime
from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.contrib.postgres.fields import JSONField
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible


class Stop(models.Model):
    atco_code = models.CharField(max_length=12, unique=True, primary_key=True, db_index=True)
    naptan_code = models.CharField(max_length=12)
    # plate_code = models.CharField(max_length=12, null=True, blank=True)
    # cleardown_code = models.CharField(max_length=10, null=True, blank=True)
    common_name = models.CharField(max_length=48)
    # common_name_lang = models.CharField(max_length=2, null=True, blank=True)
    # short_common_name = models.CharField(max_length=48, null=True, blank=True)
    # short_common_name_lang = models.CharField(max_length=2, null=True, blank=True)
    # landmark = models.CharField(max_length=48, null=True, blank=True)
    # landmark_lang = models.CharField(max_length=2, null=True, blank=True)
    # street = models.CharField(max_length=48, null=True, blank=True)
    # street_lang = models.CharField(max_length=2, null=True, blank=True)
    # crossing = models.CharField(max_length=48, null=True, blank=True)
    # crossing_lang = models.CharField(max_length=2, null=True, blank=True)
    indicator = models.CharField(max_length=48, null=True, blank=True)
    # indicator_lang = models.CharField(max_length=2, null=True, blank=True)
    # bearing = models.CharField(max_length=2)
    # nptg_locality_code = models.CharField(max_length=8)
    locality_name = models.CharField(max_length=48)
    # parent_locality_name = models.CharField(max_length=48)
    # grand_parent_locality_name = models.CharField(max_length=48)
    # town = models.CharField(max_length=48, null=True, blank=True)
    # town_lang = models.CharField(max_length=2, null=True, blank=True)
    # suburb = models.CharField(max_length=48, null=True, blank=True)
    # suburb_lang = models.CharField(max_length=2, null=True, blank=True)
    # locality_centre = models.BooleanField()
    # grid_type = models.CharField(max_length=1, null=True, blank=True)
    # easting = models.IntegerField()
    # northing = models.IntegerField()
    longitude = models.FloatField()
    latitude = models.FloatField()
    # stop_type = models.CharField(max_length=3)
    # bus_stop_type = models.CharField(max_length=3, null=True, blank=True)
    # timing_status = models.CharField(max_length=3, null=True, blank=True)
    # default_wait_time = models.IntegerField(null=True, blank=True)
    # notes = models.TextField(null=True, blank=True)
    # notes_lang = models.CharField(max_length=2, null=True, blank=True)
    # administrative_area_code = models.IntegerField()
    # creation_datetime = models.DateTimeField()
    # modification_datetime = models.DateTimeField(null=True, blank=True)
    # revision_number = models.IntegerField(null=True, blank=True)
    # modification = models.CharField(max_length=3, null=True, blank=True)
    # status = models.CharField(max_length=3, null=True, blank=True)
    gis_location = models.PointField(null=True)
    objects = models.GeoManager()
    data = JSONField(null=True, blank=True)
    last_modified = models.DateTimeField(auto_now=True)

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
    last_modified = models.DateTimeField(auto_now=True)

    @python_2_unicode_compatible
    def __str__(self):
        return self.trading_name


class Line(models.Model):
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    line_name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    operator = models.ForeignKey(Operator, related_name="lines")
    standard_origin = models.CharField(max_length=255)
    standard_destination = models.CharField(max_length=255)
    regular_days_of_week = models.CharField(max_length=255, null=True)
    bank_holiday_operation = models.CharField(max_length=255, null=True)
    start_date = models.DateField(null=True)
    end_date = models.DateField(null=True)
    rendered_timetable = models.TextField(null=True, blank=True)
    stop_list = JSONField(null=True, blank=True)
    timetable = JSONField(null=True, blank=True)
    last_modified = models.DateTimeField(auto_now=True)

    def get_stop_list(self):
        stop_list = {}
        for bound in ['inbound', 'outbound']:
            for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
                for stop in self.stop_list[bound][dayperiod]:
                    stop_list[stop] = Stop.objects.get(atco_code=stop)
        return stop_list

    def get_all_vehicle_journeys(self):
        return VehicleJourney.objects.filter(journey_pattern__route__line=self).order_by('departure_time')

    def generate_stop_list(self):
        stop_list = {
            'inbound': {
                'MondayToFriday': [],
                'Saturday': [],
                'Sunday': [],
                'HolidaysOnly': []
            },
            'outbound': {
                'MondayToFriday': [],
                'Saturday': [],
                'Sunday': [],
                'HolidaysOnly': []
            }
        }

        for bound in ['inbound', 'outbound']:
            for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
                for route in Route.objects.filter(line=self, journey_patterns__direction=bound,
                                                  journey_patterns__journeys__days_of_week=dayperiod).distinct():
                    last_stop_index = -1
                    for stop in route.stops_list.split(','):
                        if stop not in stop_list[bound][dayperiod]:
                            last_stop_index += 1
                            stop_list[bound][dayperiod].insert(last_stop_index, stop)
                        else:
                            last_stop_index = stop_list[bound][dayperiod].index(stop)
        self.stop_list = stop_list
        self.save()

    def generate_timetable(self):
        # Create list of stops per line number
        if not self.stop_list:
            self.generate_stop_list()

        line_timetable = {
            'inbound': {
                'MondayToFriday': {},
                'Saturday': {},
                'Sunday': {},
                'HolidaysOnly': {}
            },
            'outbound': {
                'MondayToFriday': {},
                'Saturday': {},
                'Sunday': {},
                'HolidaysOnly': {}
            }
        }

        for bound in ['inbound', 'outbound']:
            for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
                journeys = VehicleJourney.objects.filter(journey_pattern__route__line=self,
                                                         journey_pattern__direction=bound,
                                                         days_of_week=dayperiod).distinct().order_by('departure_time')
                timetable = line_timetable[bound][dayperiod]
                for stop in self.stop_list[bound][dayperiod]:
                    timetable[stop] = []
                i = 0
                for journey in journeys:
                    for stop in self.stop_list[bound][dayperiod]:
                        timetable[stop].append(None)
                    for journey_timetable_entry in journey.timetable:
                        try:
                            timetable[journey_timetable_entry['stop_id']][i] = journey_timetable_entry['time']
                        except:
                            print(bound, dayperiod, journey.id, journey.journey_pattern.id, journey.journey_pattern.route.id, journey_timetable_entry)
                    i += 1

        self.timetable = line_timetable
        self.save()


    @python_2_unicode_compatible
    def __str__(self):
        return "%s (%s)" % (self.line_name, self.description)


class Route(models.Model):
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    description = models.CharField(max_length=255)
    line = models.ForeignKey(Line, related_name='routes')
    stops_list = models.TextField()
    last_modified = models.DateTimeField(auto_now=True)

    def get_all_vehicle_journeys(self):
        return VehicleJourney.objects.filter(journey_pattern__route=self).order_by('departure_time')

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
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    last_modified = models.DateTimeField(auto_now=True)

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
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    stop_from = models.ForeignKey(Stop, related_name='departure_journeys')
    stop_from_timing_status = models.CharField(max_length=3)
    stop_from_sequence_number = models.IntegerField()
    stop_to = models.ForeignKey(Stop, related_name='arrival_journeys')
    stop_to_timing_status = models.CharField(max_length=3)
    stop_to_sequence_number = models.IntegerField()
    run_time = models.DurationField()
    wait_time = models.DurationField(null=True, blank=True)
    journey_pattern_section = models.ForeignKey(JourneyPatternSection, related_name='timing_links')
    last_modified = models.DateTimeField(auto_now=True)

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s (%s)" % (self.stop_from, self.stop_to, self.run_time)


class JourneyPattern(models.Model):
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    route = models.ForeignKey(Route, related_name='journey_patterns')
    direction = models.CharField(max_length=100)
    section = models.ForeignKey(JourneyPatternSection, related_name='journey_patterns')
    last_modified = models.DateTimeField(auto_now=True)

    def departure_times(self):
        return self.journeys.order_by("departure_time").values_list("departure_time", flat=True)

    @python_2_unicode_compatible
    def __str__(self):
        return "%s - %s" % (self.section, self.route)


class VehicleJourney(models.Model):
    id = models.CharField(max_length=255, primary_key=True, db_index=True)
    journey_pattern = models.ForeignKey(JourneyPattern, related_name='journeys')
    departure_time = models.TimeField()
    days_of_week = models.CharField(max_length=100, null=True)
    timetable = JSONField(null=True, blank=True)
    last_modified = models.DateTimeField(auto_now=True)

    def generate_timetable(self):
        self.timetable = []
        departure_time = datetime.datetime.strptime(self.departure_time, '%H:%M:%S')
        timing_links = self.journey_pattern.section.timing_links.order_by('stop_from_sequence_number')
        for timing_link in timing_links:
            self.timetable.append({'time': str(departure_time.time()), 'stop_id': timing_link.stop_from.atco_code})
            departure_time += timing_link.run_time
            if timing_link.wait_time:
                departure_time += timing_link.wait_time
        # TODO this should never happen but there is data that contain this error
        if timing_links.last().stop_to:
            self.timetable.append({'time': str(departure_time.time()), 'stop_id': timing_links.last().stop_to.atco_code})
        self.save()

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
