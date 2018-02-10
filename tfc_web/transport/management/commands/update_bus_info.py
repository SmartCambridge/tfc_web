import calendar
import logging
import re
import os
import xmltodict
import zipfile
from datetime import timedelta
from django.core.management import BaseCommand
from urllib.request import urlretrieve
from django.conf import settings
from django.db import transaction
from psycopg2._range import DateRange
from transport.models import *
from transport.utils.transxchange import BANK_HOLIDAYS, WEEKDAYS, DayOfWeek


logger = logging.getLogger(__name__)


xml_timedelta_regex = re.compile('(?P<sign>-?)P(?:(?P<years>\d+)Y)?(?:(?P<months>\d+)M)?(?:(?P<days>\d+)D)?'
                                 '(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+[.]‌​?\d*)S)?)?')


def xml_timedelta_to_python(xml_timedelta):
    # Fetch the match groups with default value of 0 (not None)
    duration = xml_timedelta_regex.match(xml_timedelta).groupdict(0)

    # Create the timedelta object from extracted groups
    delta = timedelta(days=int(duration['days']) + (int(duration['months']) * 30) + (int(duration['years']) * 365),
                      hours=int(duration['hours']),
                      minutes=int(duration['minutes']),
                      seconds=int(duration['seconds']))

    if duration['sign'] == "-":
        delta *= -1

    return delta


class Command(BaseCommand):
    help = "Updates bus data from zip file containing the XML files from TravelLine website"

    @transaction.atomic
    def handle(self, **options):
        Operator.objects.all().delete()
        Line.objects.all().delete()
        Route.objects.all().delete()
        JourneyPattern.objects.all().delete()
        JourneyPatternSection.objects.all().delete()
        JourneyPatternTimingLink.objects.all().delete()
        VehicleJourney.objects.all().delete()
        SpecialDaysOperation.objects.all().delete()
        Timetable.objects.all().delete()

        for tnds_zone in settings.TNDS_ZONES:
            local_filename, headers = urlretrieve('ftp://%s:%s@ftp.tnds.basemap.co.uk/%s.zip' %
                                                  (settings.TNDS_USERNAME, settings.TNDS_PASSWORD, tnds_zone),
                                                  filename=os.path.join(settings.TNDS_NEW_DIR, '%s.zip' % tnds_zone))
            traveline_zip_file = zipfile.ZipFile(local_filename)
            for filename in traveline_zip_file.namelist():
                logger.info("Processing file %s" % filename)
                try:
                    with traveline_zip_file.open(filename) as xml_file:
                        content = xmltodict.parse(xml_file)

                        if content['TransXChange']['Services']['Service']['Mode'] == "bus":
                            # Operator
                            operator = content['TransXChange']['Operators']['Operator']
                            bus_operator, created = Operator.objects.get_or_create(
                                id=operator['@id'], code=operator['OperatorCode'],
                                short_name=operator['OperatorShortName'], trading_name=operator['TradingName'])

                            # Service / Line
                            service = content['TransXChange']['Services']['Service']
                            bus_line = Line.objects.create(id=service['ServiceCode'],
                                line_name=service['Lines']['Line']['LineName'],
                                description=service['Description'],
                                operator=bus_operator,
                                standard_origin=service['StandardService']['Origin'],
                                standard_destination=service['StandardService']['Destination'],
                                start_date=service['OperatingPeriod']['StartDate'],
                                end_date=service['OperatingPeriod']['EndDate'],
                                regular_days_of_week=
                                    list(service['OperatingProfile']['RegularDayType']['DaysOfWeek'].keys())
                                if 'OperatingProfile' in service and 'RegularDayType' in service['OperatingProfile'] and 'DaysOfWeek' in service['OperatingProfile']['RegularDayType'] else ('MondayToFriday',),
                                bank_holiday_operation=
                                    list(service['OperatingProfile']['BankHolidayOperation']['DaysOfOperation'].keys())
                                if 'OperatingProfile' in service and 'BankHolidayOperation' in service['OperatingProfile'] and 'DaysOfOperation' in service['OperatingProfile']['BankHolidayOperation'] else None
                            )

                            # Routes
                            routes = content['TransXChange']['RouteSections']['RouteSection']
                            if routes.__class__ is not list:
                                routes = list([routes])
                                routes_desc = list([content['TransXChange']['Routes']['Route']])
                            else:
                                routes_desc = content['TransXChange']['Routes']['Route']
                            route_objects = []
                            for route_id in range(0, len(routes)):
                                route = routes[route_id]
                                stops = []
                                if route['RouteLink'].__class__ is list:
                                    next = None
                                    for stop in route['RouteLink']:
                                        # check if To from next item and From from current are the same
                                        if next and next != stop['From']['StopPointRef']:
                                            logger.error('route links are not sequentials in route %s' %
                                                         routes_desc[route_id]['@id'])
                                        stops.append(stop['From']['StopPointRef'])
                                        next = stop['To']['StopPointRef']
                                    stops.append(route['RouteLink'][-1]['To']['StopPointRef'])
                                else:
                                    stops.append(route['RouteLink']['From']['StopPointRef'])
                                    stops.append(route['RouteLink']['To']['StopPointRef'])
                                route_objects.append(
                                    Route(id=routes_desc[route_id]['@id'], line=bus_line, stops_list=','.join(stops),
                                    description=routes_desc[route_id]['Description']))
                            if route_objects:
                                Route.objects.bulk_create(route_objects)


                            # Journey Pattern Sections
                            journey_pattern_sections = \
                                content['TransXChange']['JourneyPatternSections']['JourneyPatternSection']
                            if journey_pattern_sections.__class__ is not list:
                                journey_pattern_sections = list([journey_pattern_sections])
                            journey_pattern_section_objects = []
                            journey_pattern_timing_link_objects = []
                            for journey_pattern_section in journey_pattern_sections:
                                journey_pattern_section_objects.append(
                                    JourneyPatternSection(id=journey_pattern_section['@id']))
                                journey_pattern_timing_links = journey_pattern_section['JourneyPatternTimingLink']
                                if journey_pattern_timing_links.__class__ is not list:
                                    journey_pattern_timing_links = list([journey_pattern_timing_links])
                                for journey_pattern_timing_link in journey_pattern_timing_links:
                                    wait_time = xml_timedelta_to_python(journey_pattern_timing_link['To']['WaitTime']) \
                                        if 'WaitTime' in journey_pattern_timing_link['To'] else None
                                    if not Stop.objects.filter(atco_code=journey_pattern_timing_link['From']['StopPointRef']):
                                        logger.error("Stop %s cannot be found in the database, creating a temporal entry" %
                                                     journey_pattern_timing_link['From']['StopPointRef'])
                                        Stop.objects.create(atco_code=journey_pattern_timing_link['From']['StopPointRef'],
                                                            naptan_code="Unknown", common_name="Unknown", indicator="Unknown",
                                                            locality_name="", longitude=0, latitude=0)
                                    if not Stop.objects.filter(atco_code=journey_pattern_timing_link['To']['StopPointRef']):
                                        logger.error("Stop %s cannot be found in the database, creating a temporal entry" %
                                                     journey_pattern_timing_link['To']['StopPointRef'])
                                        Stop.objects.create(atco_code=journey_pattern_timing_link['To']['StopPointRef'],
                                                            naptan_code="Unknown", common_name="Unknown", indicator="Unknown",
                                                            locality_name="", longitude=0, latitude=0)
                                    journey_pattern_timing_link_objects.append(JourneyPatternTimingLink(
                                        id=journey_pattern_timing_link['@id'],
                                        stop_from_id=journey_pattern_timing_link['From']['StopPointRef'],
                                        stop_to_id=journey_pattern_timing_link['To']['StopPointRef'],
                                        stop_from_timing_status=journey_pattern_timing_link['From']['TimingStatus'],
                                        stop_to_timing_status=journey_pattern_timing_link['To']['TimingStatus'],
                                        stop_from_sequence_number=journey_pattern_timing_link['From']['@SequenceNumber'],
                                        stop_to_sequence_number=journey_pattern_timing_link['To']['@SequenceNumber'],
                                        run_time=xml_timedelta_to_python(journey_pattern_timing_link['RunTime']),
                                        wait_time=wait_time,
                                        journey_pattern_section_id=journey_pattern_section['@id']
                                    ))
                            if journey_pattern_section_objects:
                                JourneyPatternSection.objects.bulk_create(journey_pattern_section_objects)
                            if journey_pattern_timing_link_objects:
                                JourneyPatternTimingLink.objects.bulk_create(journey_pattern_timing_link_objects)

                            # Journey Pattern
                            journey_patterns = \
                                content['TransXChange']['Services']['Service']['StandardService']['JourneyPattern']
                            if journey_patterns.__class__ is not list:
                                journey_patterns = list([journey_patterns])
                            journey_pattern_objects = []
                            for journey_pattern in journey_patterns:
                                journey_pattern_objects.append(JourneyPattern(
                                    id=journey_pattern['@id'], direction=journey_pattern['Direction'],
                                    route_id=journey_pattern['RouteRef'],
                                    section_id=journey_pattern['JourneyPatternSectionRefs'])
                                )
                            if journey_pattern_objects:
                                JourneyPattern.objects.bulk_create(journey_pattern_objects)

                            # Journey
                            journeys = content['TransXChange']['VehicleJourneys']['VehicleJourney']
                            journeys = list([journeys]) if journeys.__class__ is not list else journeys
                            order_journey = 1
                            vehicle_journey_objects = []
                            special_days_operation = []
                            for journey in journeys:
                                regular_days = []
                                nonoperation_bank_holidays = []
                                operation_bank_holidays = []
                                if 'OperatingProfile' in journey:
                                    element = journey['OperatingProfile']
                                    if 'RegularDayType' in element and 'DaysOfWeek' in element['RegularDayType']:
                                        week_days_element = element['RegularDayType']['DaysOfWeek']
                                        for day in list(week_days_element.keys()):
                                            if 'To' in day:
                                                day_range_bounds = [WEEKDAYS[i] for i in day.split('To')]
                                                day_range = range(day_range_bounds[0], day_range_bounds[1] + 1)
                                                regular_days += [calendar.day_name[i] for i in day_range]
                                            elif day == 'Weekend':
                                                regular_days += ["Saturday", "Sunday"]
                                            else:
                                                regular_days.append(day)

                                    # Special Days:
                                    if 'SpecialDaysOperation' in element:
                                        if 'DaysOfNonOperation' in element['SpecialDaysOperation'] and element['SpecialDaysOperation']['DaysOfNonOperation']:
                                            noopdays = element['SpecialDaysOperation']['DaysOfNonOperation']['DateRange']
                                            noopdays = list([noopdays]) if noopdays.__class__ is not list else noopdays
                                            nonoperation_days = \
                                                list(map(lambda x:
                                                         SpecialDaysOperation(vehicle_journey_id=journey['PrivateCode'],
                                                                              days=DateRange(lower=x['StartDate'],
                                                                                             upper=x['EndDate'],
                                                                                             bounds="[]"),
                                                                              operates=False), noopdays))
                                            special_days_operation += nonoperation_days
                                        if 'DaysOfOperation' in element['SpecialDaysOperation'] and element['SpecialDaysOperation']['DaysOfOperation']:
                                            opdays = element['SpecialDaysOperation']['DaysOfNonOperation']['DateRange']
                                            opdays = list([opdays]) if opdays.__class__ is not list else opdays
                                            operation_days = \
                                                list(map(lambda x:
                                                         SpecialDaysOperation(vehicle_journey_id=journey['PrivateCode'],
                                                                              days=DateRange(lower=x['StartDate'],
                                                                                             upper=x['EndDate'],
                                                                                             bounds="[]"),
                                                                              operates=True), opdays))
                                            special_days_operation += operation_days

                                    # Bank Holidays
                                    if 'BankHolidayOperation' in element:
                                        if 'DaysOfNonOperation' in element['BankHolidayOperation'] and element['BankHolidayOperation']['DaysOfNonOperation']:
                                            nonoperation_bank_holidays = list(
                                                element['BankHolidayOperation']['DaysOfNonOperation'].keys())
                                        if 'DaysOfOperation' in element['BankHolidayOperation'] and element['BankHolidayOperation']['DaysOfOperation']:
                                            operation_bank_holidays = list(
                                                element['BankHolidayOperation']['DaysOfOperation'].keys())
                                vehicle_journey_objects.append(VehicleJourney(
                                    id=journey['PrivateCode'], journey_pattern_id=journey['JourneyPatternRef'],
                                    departure_time=journey['DepartureTime'], days_of_week=' '.join(regular_days),
                                    nonoperation_bank_holidays=' '.join(nonoperation_bank_holidays),
                                    operation_bank_holidays=' '.join(operation_bank_holidays), order=order_journey)
                                )
                                order_journey += 1
                            if vehicle_journey_objects:
                                VehicleJourney.objects.bulk_create(vehicle_journey_objects)
                                SpecialDaysOperation.objects.bulk_create(special_days_operation)
                        xml_file.close()
                except Exception as e:
                    logger.exception("Error while trying to process file %s, exception was %s" % (filename, e))
        for vehicle_journey in VehicleJourney.objects.all():
            Timetable.objects.bulk_create(vehicle_journey.generate_timetable())

        for tnds_zone in settings.TNDS_ZONES:
            os.rename(os.path.join(settings.TNDS_NEW_DIR, '%s.zip' % tnds_zone),
                      os.path.join(settings.TNDS_DIR, '%s.zip' % tnds_zone))
