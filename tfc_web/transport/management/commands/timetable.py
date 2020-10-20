import argparse
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

###############################################################
# manage.py timetable --clear
# clear all PostgreSQL tables related to TNDS / timetable info
###############################################################
def cmd_clear():
    SpecialDaysOperation.objects.all().delete()
    Timetable.objects.all().delete()
    VehicleJourney.objects.all().delete()
    JourneyPattern.objects.all().delete()
    JourneyPatternSection.objects.all().delete()
    JourneyPatternTimingLink.objects.all().delete()
    Route.objects.all().delete()
    Line.objects.all().delete()
    Operator.objects.all().delete()

###############################################################
# manage.py timetable --status
# give info regarding status of TNDS data in PostgreSQL
###############################################################
def cmd_status():
    print("SpecialDaysOperation objects: {}".format(SpecialDaysOperation.objects.all().count()))
    print("Timetable objects: {}".format(Timetable.objects.all().count()))
    print("VehicleJourney objects: {}".format(VehicleJourney.objects.all().count()))
    print("JourneyPattern objects: {}".format(JourneyPattern.objects.all().count()))
    print("JourneyPatternSection objects: {}".format(JourneyPatternSection.objects.all().count()))
    print("JourneyPatternTimingLink objects: {}".format(JourneyPatternTimingLink.objects.all().count()))
    print("Route objects: {}".format(Route.objects.all().count()))
    print("Line objects: {}".format(Line.objects.all().count()))
    print("Operator objects: {}".format(Operator.objects.all().count()))

###############################################################
# Load TNDS XML data file into PostgreSQL from filesystem
###############################################################
def load_file(filename):
    print('load_file loading {}'.format(filename))
    try:
        with open(filename) as xml_file:
            load_xml(xml_file.read())
    except Exception as e:
        logger.exception("Error while trying to process file %s, exception was %s" % (filename, e))

###############################################################
# Download TNDS XML zip files and parse into PostgreSQL
###############################################################
def load_ftp():
    for tnds_zone in settings.TNDS_ZONES:
        local_filename, headers = urlretrieve('ftp://%s:%s@ftp.tnds.basemap.co.uk/%s.zip' %
                                              (settings.TNDS_USERNAME, settings.TNDS_PASSWORD, tnds_zone),
                                              filename=os.path.join(settings.TNDS_NEW_DIR, '%s.zip' % tnds_zone))
        traveline_zip_file = zipfile.ZipFile(local_filename)
        for filename in traveline_zip_file.namelist():
            logger.info("Processing file %s" % filename)
            try:
                with traveline_zip_file.open(filename) as xml_file:
                    load_xml(xml_file)
            except Exception as e:
                logger.exception("Error while trying to process file %s, exception was %s" % (filename, e))

###############################################################
# Create Operator object in PostgreSQL and return it
###############################################################
def load_operator(content):
    # Operator
    operator = content['TransXChange']['Operators']['Operator']

    # We will try and set short_name and trading_name from XML info.
    # If either is missing we'll use the other.
    short_name = 'missing'
    trading_name = 'missing'
    if 'OperatorShortName' in operator:
        short_name = operator['OperatorShortName']
    if 'TradingName' in operator:
        trading_name = operator['TradingName']
    else:
        trading_name = short_name
    if short_name == 'missing':
        short_name = trading_name

    bus_operator, created = Operator.objects.get_or_create(
        id=operator['@id'],
        defaults={'code': operator['OperatorCode'],
                  'short_name': short_name,
                  'trading_name': trading_name})

    return bus_operator

###############################################################
# Create Line object in PostgreSQL and return it
###############################################################
def load_line(content, bus_operator, service):

    # If no OperatingPeriod.StartDate, we will use today's date
    if 'StartDate' in service['OperatingPeriod']:
        start_date = service['OperatingPeriod']['StartDate']
    else:
        start_date = dt.now().strftime('%Y-%m-%d')

    # If there is no service.OperatingPeriod.EndDate we will set it to StartDate + 200 days
    if 'EndDate' in service['OperatingPeriod']:
        end_date = service['OperatingPeriod']['EndDate']
    else:
        # No OperatingPeriod.EndDate available, so add 200 days to StartDate
        datetime_end_date = dt.strptime(start_date,'%Y-%m-%d') + timedelta(days=200)
        end_date = datetime_end_date.strftime('%Y-%m-%d')

    bus_line = Line.objects.create(
        line_id=service['Lines']['Line']['@id'],
        line_name=service['Lines']['Line']['LineName'],
        area='tnds_zone', # ijl20 - this was var tnds_zone, but seems not used anywhere
        filename=content['TransXChange']['@FileName'],
        description=service.get('Description', ''),
        operator=bus_operator,
        standard_origin=service['StandardService']['Origin'],
        standard_destination=service['StandardService']['Destination'],
        start_date=start_date,
        end_date=end_date,
        regular_days_of_week=
            list(service['OperatingProfile']['RegularDayType']['DaysOfWeek'].keys())
        if 'OperatingProfile' in service and
           'RegularDayType' in service['OperatingProfile'] and
           'DaysOfWeek' in service['OperatingProfile']['RegularDayType']
            else ('MondayToFriday',),
        bank_holiday_operation=
            list(service['OperatingProfile']['BankHolidayOperation']['DaysOfOperation'].keys())
        if 'OperatingProfile' in service and
           'BankHolidayOperation' in service['OperatingProfile'] and
           'DaysOfOperation' in service['OperatingProfile']['BankHolidayOperation'] else None
    )

    return bus_line

###############################################################
# Create Route objects in PostgreSQL
###############################################################
def load_routes(content, bus_line, service_code):
    route_objects = []

    # Collect all the routesections under the <RouteSections> tag
    routesections = content['TransXChange']['RouteSections']['RouteSection']
    if routesections.__class__ is not list:
        routesections = list([routesections])
        routes = list([content['TransXChange']['Routes']['Route']])
    else:
        routes = content['TransXChange']['Routes']['Route']

    # Iterate the <Routes>, iterate the <RouteSection>s for each <Route>
    for route_id in range(0, len(routes)):
        route = routes[route_id]
        stops = []

        # get the list of RouteSection id's for the current Route
        routesection_refs = route['RouteSectionRef']
        if routesection_refs.__class__ is not list:
            routesection_refs = list([routesection_refs])

        for routesection_ref in routesection_refs:
            routesection = None

            # OK, now we need to search for the RouteSection with id=routesection_ref
            for rs in routesections:
                if rs['@id'] == routesection_ref:
                    routesection = rs
                    break

            if routesection['RouteLink'].__class__ is list:
                next = None
                for stop in routesection['RouteLink']:
                    # check if To from next item and From from current are the same
                    if next and next != stop['From']['StopPointRef']:
                        logger.error('route links are not sequentials in route %s' %
                                     routes[route_id]['@id'])
                    stops.append(stop['From']['StopPointRef'])
                    next = stop['To']['StopPointRef']
                stops.append(routesection['RouteLink'][-1]['To']['StopPointRef'])
            else:
                stops.append(routesection['RouteLink']['From']['StopPointRef'])
                stops.append(routesection['RouteLink']['To']['StopPointRef'])

        # Create Route object and add to route_objects
        route_objects.append(
            Route(id='tnds_zone'+'-'+service_code+'-'+routes[route_id]['@id'], line=bus_line,
                  stops_list=','.join(stops),
                  description=routes[route_id]['Description']))

    # Store route_objects to Route table (i.e. transport_route)
    if route_objects:
        Route.objects.bulk_create(route_objects)

def load_xml(xml_file):
    content = xmltodict.parse(xml_file)

    if content['TransXChange']['Services']['Service'].get('Mode') in ["bus", "coach"]:

        bus_operator = load_operator(content)

        service = content['TransXChange']['Services']['Service']

        bus_line = load_line(content, bus_operator, service)

        service_code = service['ServiceCode'] # will re-use for Route

        load_routes(content, bus_line, service_code)

        # Journey Pattern Sections
        journey_pattern_sections = \
            content['TransXChange']['JourneyPatternSections']['JourneyPatternSection']
        if journey_pattern_sections.__class__ is not list:
            journey_pattern_sections = list([journey_pattern_sections])
        journey_pattern_section_objects = []
        journey_pattern_timing_link_objects = []
        for journey_pattern_section in journey_pattern_sections:
            journey_pattern_section_objects.append(
                JourneyPatternSection(id=tnds_zone+'-'+journey_pattern_section['@id']))
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
                    id=tnds_zone+'-'+journey_pattern_timing_link['@id'],
                    stop_from_id=journey_pattern_timing_link['From']['StopPointRef'],
                    stop_to_id=journey_pattern_timing_link['To']['StopPointRef'],
                    stop_from_timing_status=journey_pattern_timing_link['From']['TimingStatus'],
                    stop_to_timing_status=journey_pattern_timing_link['To']['TimingStatus'],
                    stop_from_sequence_number=journey_pattern_timing_link['From']['@SequenceNumber'],
                    stop_to_sequence_number=journey_pattern_timing_link['To']['@SequenceNumber'],
                    run_time=xml_timedelta_to_python(journey_pattern_timing_link['RunTime']),
                    wait_time=wait_time,
                    journey_pattern_section_id=tnds_zone+'-'+journey_pattern_section['@id']
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
                id=tnds_zone+'-'+journey_pattern['@id'], direction=journey_pattern['Direction'],
                route_id=tnds_zone+'-'+journey_pattern['RouteRef'],
                section_id=tnds_zone+'-'+journey_pattern['JourneyPatternSectionRefs'])
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
                id=journey['PrivateCode'], journey_pattern_id=tnds_zone+'-'+journey['JourneyPatternRef'],
                departure_time=journey['DepartureTime'], days_of_week=' '.join(regular_days),
                nonoperation_bank_holidays=' '.join(nonoperation_bank_holidays),
                operation_bank_holidays=' '.join(operation_bank_holidays), order=order_journey)
            )
            order_journey += 1
        if vehicle_journey_objects:
            VehicleJourney.objects.bulk_create(vehicle_journey_objects)
            SpecialDaysOperation.objects.bulk_create(special_days_operation)
    xml_file.close()

class Command(BaseCommand):
    help = "Updates database from TNDS XML file"

    def add_arguments(self, parser):

        parser.add_argument(
            '--loadfile',
            help='Load XML file into database',
        )

        parser.add_argument(
            '--loadftp',
            nargs='?',
            const='NO ARGS',
            help='Load timetable info from TNDS ftp',
        )

        parser.add_argument(
            '--clear',
            nargs='?',
            const='NO ARGS',
            help='Clear timetable info from database',
        )

        parser.add_argument(
            '--status',
            nargs='?',
            const='NO ARGS',
            help='Show database status for TNDS timetable data',
        )

    @transaction.atomic
    def handle(self, **options):

        if options['loadfile']:
            filename = options['loadfile']
            print('loading {}'.format(filename))
            load_file(filename)
            return

        if options['loadftp']:
            print('loading timetables from TNDS')
            load_ftp()
            return

        if options['clear']:
            print('clearing timetable data from database')
            cmd_clear()
            return

        if options['status']:
            print('Showing timetable data status in database')
            cmd_status()
            return

        if True:
            return

        for vehicle_journey in VehicleJourney.objects.all():
            Timetable.objects.bulk_create(vehicle_journey.generate_timetable())

        for tnds_zone in settings.TNDS_ZONES:
            os.rename(os.path.join(settings.TNDS_NEW_DIR, '%s.zip' % tnds_zone),
                      os.path.join(settings.TNDS_DIR, '%s.zip' % tnds_zone))
