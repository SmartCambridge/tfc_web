from django.contrib.gis.db import models
from django.contrib.gis.geos import Point
from django.contrib.postgres.fields import DateRangeField
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.urls import reverse
from django.db.models import Q
from datetime import datetime, timedelta
import isodate

class Stop(models.Model):
    #####################
    #    Model to store Stop information
    #
    #    Fields: 
    #    - `naptan_code`: The NaPTAN code for the stop point.
    #    - `short_common_name`: The short version of the common name.
    #    - `common_name`: The full version of the common name.
    #    - `landmark`: A nearby landmark.
    #    - `street`: The street where the stop is located.
    #    - `crossing`: Information about the nearest crossing.
    #    - `indicator`: A short text indicating the location of the stop.
    #    - `bearing`: The bearing (direction) of the stop.
    #    - `nptg_locality_code`: The National Public Transport Gazetteer (NPTG) locality code.
    #    - `locality_name`: The name of the locality.
    #    - `parent_locality_name`: The name of the parent locality.
    #    - `grand_parent_locality_name`: The name of the grandparent locality.
    #    - `town`: The name of the town where the stop is located.
    #    - `suburb`: The nameo of the suburb where the stop is located.
    #    - `stop_type`: The type of stop point (e.g., "BusStop", "CoachStop", "HailAndRide", "OnStreetTram", "OnStreetRail", or "Other").
    #    - `bus_stop_type`: The bus stop type (e.g., "Marked", "Unmarked", "Flag", "Shelter", "Pole", "Custom").
    #    - `timing_status`: The timing status of the stop (e.g., "otherPoint", "timingPoint", "principalPoint").
    #    - `accessibility`: Accessibility information (e.g., "unknown", "yes", "no", "partial").
    #    - `administrative_area_code`: The code for the administrative area where the stop is located.
    #    - `creation_date`: The date the stop was created.
    #    - `modification_date`: The date the stop was last modified.
    #    - `status`: The status of the stop (e.g., "active", "suspended", "deleted").
    #
    #####################

    atco_code = models.CharField(max_length=16, primary_key=True)
    naptan_code = models.CharField(max_length=16, null=True, blank=True)
    short_common_name = models.CharField(max_length=64, null=True, blank=True)
    common_name = models.CharField(max_length=128, null=True, blank=True)
    landmark = models.CharField(max_length=128, null=True, blank=True)
    street = models.CharField(max_length=128, null=True, blank=True)
    crossing = models.CharField(max_length=128, null=True, blank=True)
    indicator = models.CharField(max_length=64, null=True, blank=True)
    bearing = models.CharField(max_length=16, null=True, blank=True)
    nptg_locality_code = models.CharField(max_length=16, null=True, blank=True)
    locality_name = models.CharField(max_length=128, null=True, blank=True)
    parent_locality_name = models.CharField(max_length=128, null=True, blank=True)
    grand_parent_locality_name = models.CharField(max_length=128, null=True, blank=True)
    town = models.CharField(max_length=128, null=True, blank=True)
    suburb = models.CharField(max_length=128, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    stop_type = models.CharField(max_length=16, null=True, blank=True)
    bus_stop_type = models.CharField(max_length=16, null=True, blank=True)
    timing_status = models.CharField(max_length=16, null=True, blank=True)
    accessibility = models.CharField(max_length=16, null=True, blank=True)
    administrative_area_code = models.CharField(max_length=16, null=True, blank=True)
    creation_date = models.DateField(null=True, blank=True)
    modification_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, null=True, blank=True)

    gis_location = models.PointField(null=True)
    data = models.JSONField(null=True, blank=True)
    last_modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['atco_code']

    def __str__(self):
        if self.indicator:
            if self.indicator in ('opp', 'adj', 'at', 'o/s', 'nr', 'before', 'after', 'by', 'on', 'in', 'near'):
                return '%s, %s %s' % (self.locality_name, self.indicator, self.common_name) \
                    if self.locality_name else '%s %s' % (self.indicator, self.common_name)
            else:
                return '%s, %s (%s)' % (self.locality_name, self.common_name, self.indicator) \
                    if self.locality_name else '%s (%s)' % (self.common_name, self.indicator)
        else:
            return '%s, %s' % (self.locality_name, self.common_name) if self.locality_name else '%s' % self.common_name

    def next_departures(self, lite = True, current_time = datetime.now()):
        from transport.api.serializers import StopSerializer

        journey_patterns = JourneyPattern.objects.filter(journeypatterntiminglink__from_stop=self).distinct()

        day_of_week = current_time.strftime('%A').lower()
        vehicle_journeys = VehicleJourney.objects.filter(
            Q(**{day_of_week: True}),
            journey_pattern__in=journey_patterns
        )

        next_departures = []
        for vehicle_journey in vehicle_journeys:
            journey_pattern_timing_links = JourneyPatternTimingLink.objects.filter(
                jp=vehicle_journey.journey_pattern
            ).order_by('order')

            departure_time = vehicle_journey.departure_time
            origin_departure_datetime = current_time.replace(hour=departure_time.hour, minute=departure_time.minute, second=departure_time.second)

            timetable = []
            order = 1
            if lite:
                stop_id = journey_pattern_timing_links[0].from_stop_id
                stop = {"id": stop_id, "locality_name": ""}
            else:
                stop = journey_pattern_timing_links[0].from_stop
            timetable.append({
                "order": order,
                "stop": stop if lite else StopSerializer(stop).data,
                "time": departure_time
            })
            if (lite and stop['id'] == self.atco_code) or (not lite and stop.id == self.atco_code):
                current_stop_departure_time = departure_time
            total_run_time = timedelta()
            for jptl in journey_pattern_timing_links:
                total_run_time += isodate.parse_duration(jptl.run_time)
                if lite:
                    stop_id = jptl.to_stop_id
                    stop = {"id": stop_id, "locality_name": ""}
                else:
                    stop = jptl.to_stop
                departure_datetime = origin_departure_datetime + total_run_time
                departure_time = departure_datetime.time()
                order += 1
                timetable.append({
                    "order": order,
                    "stop": stop if lite else StopSerializer(stop).data,
                    "time": departure_time
                })
                if (lite and stop['id'] == self.atco_code) or (not lite and stop.id == self.atco_code):
                    current_stop_departure_time = departure_time

            time_diff = (datetime.combine(current_time.date(), current_stop_departure_time) - current_time) % timedelta(days=1)
            departure_datetime = current_time + time_diff
            departure_time = departure_datetime.time()
            if departure_datetime.date() == current_time.date():
                next_departures.append({'vehicle_journey': vehicle_journey, 'time': departure_time, 'timetable': timetable})

        next_departures.sort(key=lambda x: x['time'])
        return next_departures

    def get_coordinates(self):
        return [self.latitude, self.longitude]

    def get_absolute_url(self):
        return reverse('bus-stop', args=(self.atco_code,))

@receiver(pre_save, sender=Stop)
def update_gis_fields(sender, instance, **kwargs):
    instance.gis_location = Point(float(instance.longitude), float(instance.latitude))

# class Stop(models.Model):
#     atco_code = models.CharField(max_length=12, unique=True, primary_key=True, db_index=True)
#     naptan_code = models.CharField(max_length=12)
#     # plate_code = models.CharField(max_length=12, null=True, blank=True)
#     # cleardown_code = models.CharField(max_length=10, null=True, blank=True)
#     common_name = models.CharField(max_length=48)
#     indicator = models.CharField(max_length=48, null=True, blank=True)
#     locality_name = models.CharField(max_length=48)
#     # locality_centre = models.BooleanField()
#     # grid_type = models.CharField(max_length=1, null=True, blank=True)
#     longitude = models.FloatField()
#     latitude = models.FloatField()
#     # default_wait_time = models.IntegerField(null=True, blank=True)
#     # notes = models.TextField(null=True, blank=True)
#     # revision_number = models.IntegerField(null=True, blank=True)
#     gis_location = models.PointField(null=True)
#     data = models.JSONField(null=True, blank=True)
#     last_modified = models.DateTimeField(auto_now=True)

class TransXChange(models.Model):
    file_name = models.CharField(max_length=255)
    creation_date_time = models.DateTimeField()
    modification_date_time = models.DateTimeField()
    schema_version = models.CharField(max_length=50)
    revision_number = models.IntegerField()

class Operator(models.Model):
    operator_id = models.CharField(max_length=20, primary_key=True, db_index=True)
    operator_code = models.CharField(max_length=20, db_index=True)
    national_operator_code = models.CharField(max_length=20, db_index=True)
    operator_short_name = models.CharField(max_length=100, blank=True, null=True)
    operator_name = models.CharField(max_length=200, blank=True, null=True)
    trading_name = models.CharField(max_length=200, blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    contact_email = models.CharField(max_length=200, blank=True, null=True)
    contact_url = models.CharField(max_length=200, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    license_expiry_date = models.DateField(blank=True, null=True)
    street = models.CharField(max_length=200, blank=True, null=True)
    locality = models.CharField(max_length=200, blank=True, null=True)
    town = models.CharField(max_length=200, blank=True, null=True)
    postcode = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return self.trading_name or self.short_name or self.code

class Line(models.Model):
    line_id = models.CharField(max_length=64, primary_key=True)
    line_name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    # The mode of transport for this line (e.g., bus, train, tram, etc.).
    transport_mode = models.CharField(max_length=64, null=True, blank=True)
    # private_code: An optional private code used by the operator.
    private_code = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return self.line_name

class Service(models.Model):
    # service_code: A unique identifier for the service.
    # operating_period_start: The start date of the operating period.
    # operating_period_end: The end date of the operating period.
    # registered_travel_mode: The registered mode of transport for this service (e.g., bus, train, tram, etc.).
    # description: A description of the service.
    # standard_origin: The standard origin of the service.
    # standard_destination: The standard destination of the service.
    # operator: A ForeignKey field linking the service to the operator that runs it.
    # line: A ForeignKey field linking the service to the line it belongs to.
    service_code = models.CharField(max_length=64, primary_key=True)
    operating_period_start = models.DateField()
    operating_period_end = models.DateField(null=True, blank=True)
    registered_travel_mode = models.CharField(max_length=64, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    standard_origin = models.CharField(max_length=255, null=True, blank=True)
    standard_destination = models.CharField(max_length=255, null=True, blank=True)
    line = models.ForeignKey(Line, on_delete=models.CASCADE)
    operator = models.ForeignKey(Operator, to_field='operator_id', on_delete=models.CASCADE)
    tx = models.ForeignKey(TransXChange, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.service_code} - {self.description}"
    
    class Meta:
        unique_together = [['service_code', 'tx']]

# class Service(models.Model):
#     regular_days_of_week = models.CharField(max_length=255, null=True)
#     bank_holiday_operation = models.CharField(max_length=255, null=True)
#     stop_list = models.JSONField(null=True, blank=True)
#     timetable = models.JSONField(null=True, blank=True)
#     slug = models.SlugField(max_length=50)
#     last_modified = models.DateTimeField(auto_now=True)

    # def get_stop_list(self):
    #     stop_list = {}
    #     for bound in ['inbound', 'outbound']:
    #         for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
    #             for stop in self.stop_list[bound][dayperiod]:
    #                 stop_list[stop] = Stop.objects.get(atco_code=stop)
    #     return stop_list

    # def get_all_vehicle_journeys(self):
    #     return VehicleJourney.objects.filter(journey_pattern__route__line=self).order_by('departure_time')

    # def generate_stop_list(self):
    #     stop_list = {
    #         'inbound': {
    #             'MondayToFriday': [],
    #             'Saturday': [],
    #             'Sunday': [],
    #             'HolidaysOnly': []
    #         },
    #         'outbound': {
    #             'MondayToFriday': [],
    #             'Saturday': [],
    #             'Sunday': [],
    #             'HolidaysOnly': []
    #         }
    #     }

    #     for bound in ['inbound', 'outbound']:
    #         for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
    #             stop_list[bound][dayperiod] = list(Stop.objects.filter(
    #                 departure_journeys__journey_pattern_section__journey_patterns__route__in=
    #                 Route.objects.filter(line=self, journey_patterns__direction=bound,
    #                                      journey_patterns__journeys__days_of_week=dayperiod)).distinct()\
    #                 .order_by('departure_journeys__stop_from_sequence_number').values_list('atco_code', flat=True))
    #             last_stop = Stop.objects.filter(
    #                 arrival_journeys__journey_pattern_section__journey_patterns__route__in=
    #                 Route.objects.filter(line=self, journey_patterns__direction=bound,
    #                                      journey_patterns__journeys__days_of_week=dayperiod))\
    #                 .order_by('departure_journeys__stop_to_sequence_number').last()
    #             if last_stop:
    #                 stop_list[bound][dayperiod].append(last_stop.atco_code)
    #     self.stop_list = stop_list
    #     self.save()

    # def generate_timetable(self):
    #     # Create list of stops per line number
    #     self.generate_stop_list()

    #     line_timetable = {
    #         'inbound': {
    #             'MondayToFriday': {},
    #             'Saturday': {},
    #             'Sunday': {},
    #             'HolidaysOnly': {}
    #         },
    #         'outbound': {
    #             'MondayToFriday': {},
    #             'Saturday': {},
    #             'Sunday': {},
    #             'HolidaysOnly': {}
    #         }
    #     }

    #     for bound in ['inbound', 'outbound']:
    #         for dayperiod in ['MondayToFriday', 'Saturday', 'Sunday', 'HolidaysOnly']:
    #             journeys = VehicleJourney.objects.filter(journey_pattern__route__line=self,
    #                                                      journey_pattern__direction=bound,
    #                                                      days_of_week=dayperiod).distinct().order_by('departure_time')
    #             timetable = line_timetable[bound][dayperiod]
    #             for stop in self.stop_list[bound][dayperiod]:
    #                 timetable[stop] = []
    #             i = 0
    #             for journey in journeys:
    #                 journey.generate_timetable()
    #                 for stop in self.stop_list[bound][dayperiod]:
    #                     timetable[stop].append(None)
    #                 for journey_timetable_entry in journey.timetable:
    #                     try:
    #                         timetable[journey_timetable_entry['stop_id']][i] = journey_timetable_entry['time']
    #                     except:
    #                         print(bound, dayperiod, journey.id, journey.journey_pattern.id, journey.journey_pattern.route.id, journey_timetable_entry)
    #                 i += 1

    #     self.timetable = line_timetable
    #     self.save()

    # def get_stops_list(self):
    #     bus_stops = []
    #     for stop in self.stops_list.split(','):
    #         bus_stops.append(Stop.objects.get(atco_code=stop))
    #     return bus_stops

    # def get_route_coordinates(self):
    #     bus_stops = []
    #     for stop in self.stops_list.split(','):
    #         bus_stops.append(Stop.objects.get(atco_code=stop).get_coordinates())
    #     return bus_stops

class JourneyPattern(models.Model):
    jp_id = models.CharField(max_length=50, blank=False, null=False)
    direction = models.CharField(max_length=50, blank=True, null=True)
    destination_display = models.CharField(max_length=500, blank=True, null=True)
    route_private_code = models.CharField(max_length=255, blank=True, null=True)
    route_description = models.CharField(max_length=500, blank=True, null=True)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    # journey_pattern_code = models.CharField(max_length=20)
    # route_ref = models.CharField(max_length=200, blank=True)
    # distance = models.FloatField()
    # minimum_run_time = models.CharField(max_length=8, blank=True)
    # route = models.ForeignKey(Route, on_delete=models.CASCADE)

    # I'm not sure if I need this
    # stops = models.ManyToManyField('Stop', through='JourneyPatternStop')

    class Meta:
        unique_together = [['jp_id', 'service']]


class JourneyPatternTimingLink(models.Model):
    jptl_id = models.CharField(max_length=50, blank=False, null=False)
    from_display = models.CharField(max_length=255, blank=True, null=True)
    from_stop = models.ForeignKey(Stop, on_delete=models.CASCADE, related_name='journey_departures')
    from_timing_status = models.CharField(max_length=50, blank=True, null=True)
    from_sequence_number = models.IntegerField(blank=True, null=True)
    to_display = models.CharField(max_length=255, blank=True, null=True)
    to_stop = models.ForeignKey(Stop, on_delete=models.CASCADE, related_name='journey_arrivals')
    to_timing_status = models.CharField(max_length=50, blank=True, null=True) # Format is e.g. OTH
    to_sequence_number = models.IntegerField(blank=True, null=True)
    distance = models.IntegerField(blank=True, null=True)
    direction = models.CharField(max_length=50, blank=True, null=True) # outbound or inbound
    run_time = models.CharField(max_length=50, blank=True, null=True) # Format is e.g. PT3M0S
    jp = models.ForeignKey(JourneyPattern, on_delete=models.CASCADE)
    order = models.IntegerField()

    class Meta:
        unique_together = [['jptl_id', 'jp']]
        ordering = ['order']

    # JourneyPatternTimingLink TransXchange XML example
    #   <JourneyPatternTimingLink id="JPTL4">
    #     <From>
    #       <DynamicDestinationDisplay>Trumpington</DynamicDestinationDisplay>
    #       <StopPointRef>0500CCITY184</StopPointRef>
    #       <TimingStatus>OTH</TimingStatus>
    #     </From>
    #     <To>
    #       <DynamicDestinationDisplay>Trumpington</DynamicDestinationDisplay>
    #       <StopPointRef>0500CCITY076</StopPointRef>
    #       <TimingStatus>OTH</TimingStatus>
    #     </To>
    #     <RouteLinkRef>RL14</RouteLinkRef>
    #     <RunTime>PT3M0S</RunTime>
    #   </JourneyPatternTimingLink>
    
    #   <RouteLink id="RL14">
    #     <From>
    #       <StopPointRef>0500CCITY184</StopPointRef>
    #     </From>
    #     <To>
    #       <StopPointRef>0500CCITY076</StopPointRef>
    #     </To>
    #     <Distance>1337</Distance>
    #     <Direction>outbound</Direction>
    #   </RouteLink>


class VehicleJourney(models.Model):
    journey_pattern = models.ForeignKey(JourneyPattern, on_delete=models.CASCADE)
    line = models.ForeignKey(Line, on_delete=models.SET_NULL, null=True, blank=True)
    operator = models.ForeignKey(Operator, on_delete=models.SET_NULL, null=True, blank=True)
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True)
    vehicle_journey_code = models.CharField(max_length=64, null=True, blank=True)
    vehicle_journey_id = models.CharField(max_length=64, null=True, blank=True)
    departure_time = models.TimeField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    monday = models.BooleanField(default=False)
    tuesday = models.BooleanField(default=False)
    wednesday = models.BooleanField(default=False)
    thursday = models.BooleanField(default=False)
    friday = models.BooleanField(default=False)
    saturday = models.BooleanField(default=False)
    sunday = models.BooleanField(default=False)
    bank_holiday_operation = models.TextField(null=True, blank=True)
    direction = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        ordering = ['departure_time']
        unique_together = [['vehicle_journey_code', 'service']]

    def __str__(self):
        return f"{self.vehicle_journey_code} ({self.departure_time})"

    # VehicleJourney TransXchange XML example
    # <VehicleJourney SequenceNumber="1065">
    #   <PrivateCode>4SU:O:0:3439:t4h-E8L86BA</PrivateCode>
    #   <Direction>inbound</Direction>
    #   <OperatingProfile>
    #     <RegularDayType>
    #       <DaysOfWeek>
    #         <Sunday />
    #       </DaysOfWeek>
    #     </RegularDayType>
    #     <BankHolidayOperation>
    #       <DaysOfOperation>
    #         <GoodFriday />
    #         <LateSummerBankHolidayNotScotland />
    #         <MayDay />
    #         <EasterMonday />
    #         <SpringBank />
    #         <ChristmasDayHoliday />
    #         <BoxingDayHoliday />
    #         <NewYearsDayHoliday />
    #       </DaysOfOperation>
    #       <DaysOfNonOperation>
    #         <ChristmasDay />
    #         <BoxingDay />
    #         <NewYearsDay />
    #         <ChristmasEve />
    #         <NewYearsEve />
    #       </DaysOfNonOperation>
    #     </BankHolidayOperation>
    #   </OperatingProfile>
    #   <VehicleJourneyCode>VJ1065</VehicleJourneyCode>
    #   <ServiceRef>EA_SC_SCCM_4_1</ServiceRef>
    #   <LineRef>SL1</LineRef>
    #   <JourneyPatternRef>JP3</JourneyPatternRef>
    #   <DepartureTime>16:39:00</DepartureTime>
    # </VehicleJourney>
