import argparse
import calendar
import logging
import re
import os
import xmltodict
import zipfile
from datetime import datetime as dt
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
    Route.objects.all().delete()
    Operator.objects.all().delete()
    Line.objects.all().delete()
    VehicleJourney.objects.all().delete()
    TimetableStop.objects.all().delete()

###############################################################
# manage.py timetable --status
# give info regarding status of TNDS data in PostgreSQL
###############################################################
def cmd_status():
    print("Operator objects: {}".format(Operator.objects.all().count()))
    print("Route objects: {}".format(Route.objects.all().count()))
    print("Line objects: {}".format(Line.objects.all().count()))
    print("SpecialDaysOperation objects: {}".format(SpecialDaysOperation.objects.all().count()))
    print("VehicleJourney objects: {}".format(VehicleJourney.objects.all().count()))
    print("TimetableStop objects: {}".format(TimetableStop.objects.all().count()))

###############################################################
# Load TNDS XML data file into PostgreSQL from filesystem
###############################################################
def load_xml_file(tnds_zone, filename):
#    print('load_xml_file loading {} {}'.format(tnds_zone, filename))
    try:
        with open(filename) as xml_file:
            load_xml(tnds_zone, xml_file.read())
    except Exception as e:
        logger.exception("Error while trying to process file %s, exception was %s" % (filename, e))

###############################################################
# Load TNDS Zip file into PostgreSQL from filesystem
###############################################################
def load_zip_file(tnds_zone, filename):
    print('load_zip_file loading {} {}'.format(tnds_zone, filename))
    try:
        traveline_zip_file = zipfile.ZipFile(filename)
        for filename in traveline_zip_file.namelist():
            logger.info("Processing file %s" % filename)
            try:
                with traveline_zip_file.open(filename) as xml_file:
                    with transaction.atomic():
                        load_xml(tnds_zone, xml_file)
            except Exception as e:
                logger.exception("Error while trying to process file %s, exception was %s" % (filename, e))
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
        load_zip_file(tnds_zone, local_filename)

    for tnds_zone in settings.TNDS_ZONES:
        os.rename(os.path.join(settings.TNDS_NEW_DIR, '%s.zip' % tnds_zone),
                  os.path.join(settings.TNDS_DIR, '%s.zip' % tnds_zone))

###############################################################
# Create XML -> Operator object in PostgreSQL and return it
###############################################################
def load_operator(xml_content):
    # Operator
    operator = xml_content['TransXChange']['Operators']['Operator']

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
# Create XML -> Line object in PostgreSQL and return it
###############################################################
def load_line(tnds_zone, xml_content, bus_operator, service):

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

    line = Line.objects.create(
        line_id=service['Lines']['Line']['@id'],
        line_name=service['Lines']['Line']['LineName'],
        area=tnds_zone, # ijl20 - not used anywhere ?
        filename=xml_content['TransXChange']['@FileName'],
        description=service.get('Description', ''),
        operator=bus_operator,
        standard_origin=service['StandardService']['Origin'] if 'Origin' in service['StandardService'] else None,
        standard_destination=service['StandardService']['Destination']if 'Destination' in service['StandardService'] else None,
        start_date=start_date,
        end_date=end_date,
        regular_days_of_week = (
                list(service['OperatingProfile']['RegularDayType']['DaysOfWeek'].keys())
                if 'OperatingProfile' in service and
                   'RegularDayType' in service['OperatingProfile'] and
                   'DaysOfWeek' in service['OperatingProfile']['RegularDayType']
                    else ('MondayToFriday',)),
        bank_holiday_operation = (
                list(service['OperatingProfile']['BankHolidayOperation']['DaysOfOperation'].keys())
                if 'OperatingProfile' in service and
                   'BankHolidayOperation' in service['OperatingProfile'] and
                   'DaysOfOperation' in service['OperatingProfile']['BankHolidayOperation'] else None )
    )

    return line

###############################################################
# Create XML -> Route objects in PostgreSQL
###############################################################
def load_routes(tnds_zone, service_code, xml_content, line):
    route_objects = []

    # Collect all the routesections under the <RouteSections> tag
    routesections = xml_content['TransXChange']['RouteSections']['RouteSection']
    if routesections.__class__ is not list:
        routesections = list([routesections])

    routes = xml_content['TransXChange']['Routes']['Route']
    if routes.__class__ is not list:
        routes = list([routes])

    # Iterate the <Routes>, iterate the <RouteSection>s for each <Route>
    for route_id in range(0, len(routes)):
        route = routes[route_id]
        stops = []

        # get the list of RouteSection id's for the current Route
        routesection_refs = route['RouteSectionRef'] # e.g. [ "RS1", "RS2", "RS3" ]
        if routesection_refs.__class__ is not list:
            routesection_refs = list([routesection_refs])

        for routesection_ref in routesection_refs:
            routesection = None

            # OK, now we need to search for the RouteSection with id=routesection_ref
            for rs in routesections:
                if rs['@id'] == routesection_ref:
                    routesection = rs
                    break

            routelinks = routesection['RouteLink']

            if routelinks.__class__ is not list:
                routelinks = list([routelinks])

            next_ref = None
            for routelink in routelinks:
                # check if To from next item and From from current are the same
                stop_point_ref = routelink['From']['StopPointRef']
                if next_ref and next_ref != stop_point_ref:
                    logger.error('route links are not sequentials at {} in route {} {}'
                                    .format(stop_point_ref, service_code, routes[route_id]['@id']))
                stops.append(stop_point_ref)
                next_ref = routelink['To']['StopPointRef']

        # Add FINAL stop (<To><StopPointRef> of last <RouteLink> in last <RouteSection>)
        stops.append(routelinks[-1]['To']['StopPointRef'])

        # Create Route object and add to route_objects
        route_objects.append(
            Route(id=tnds_zone+'-'+service_code+'-'+routes[route_id]['@id'], line=line,
                  stops_list=','.join(stops),
                  description=routes[route_id]['Description']))

    # Store route_objects to Route table (i.e. transport_route)
    if route_objects:
        Route.objects.filter(id__in=[r.id for r in route_objects]).delete()
        Route.objects.bulk_create(route_objects)

##################################################################################
# Parse <JourneyPatternSection> and <JourneyPatternTimingLink> elements
#
# returns a dictionary:
#   JourneyPatternSection_id: [ list of timing_link objects ]
#
##################################################################################
def parse_journey_pattern_sections(xml_content):
    # Journey Pattern Sections
    sections = xml_content['TransXChange']['JourneyPatternSections']['JourneyPatternSection']
    if sections.__class__ is not list:
        sections = list([sections])

    section_objects = {}

    for section in sections:

        section_timing_links = []
        # Get list of JourneyPatternTimingLink elements within this JourneyPatternSection
        timing_links = section['JourneyPatternTimingLink']
        if timing_links.__class__ is not list:
            timing_links = list([timing_links])

        # Iterate those JourneyPatternTimingLink elements
        for timing_link in timing_links:
            wait_time = xml_timedelta_to_python(timing_link['To']['WaitTime']) \
                if 'WaitTime' in timing_link['To'] else None

            # Create Stop objects if they are not already in database (=> not from NaPTAN)
            if not Stop.objects.filter(atco_code=timing_link['From']['StopPointRef']):
                logger.error("Stop %s cannot be found in the database, creating a temporal entry" %
                             timing_link['From']['StopPointRef'])
                Stop.objects.create(atco_code=timing_link['From']['StopPointRef'],
                                    naptan_code="Unknown", common_name="Unknown", indicator="Unknown",
                                    locality_name="", longitude=0, latitude=0)
            if not Stop.objects.filter(atco_code=timing_link['To']['StopPointRef']):
                logger.error("Stop %s cannot be found in the database, creating a temporal entry" %
                             timing_link['To']['StopPointRef'])
                Stop.objects.create(atco_code=timing_link['To']['StopPointRef'],
                                    naptan_code="Unknown", common_name="Unknown", indicator="Unknown",
                                    locality_name="", longitude=0, latitude=0)

            stop_from_sequence_number = None
            if "@SequenceNumber" in timing_link['From']:
                stop_from_sequence_number = timing_link['From']['@SequenceNumber']

            stop_to_sequence_number = None
            if "@SequenceNumber" in timing_link['To']:
                stop_to_sequence_number = timing_link['To']['@SequenceNumber']

            section_timing_links.append({
                'id': timing_link['@id'],
                'stop_from_id': timing_link['From']['StopPointRef'],
                'stop_to_id': timing_link['To']['StopPointRef'],
                'stop_from_timing_status': timing_link['From']['TimingStatus'],
                'stop_to_timing_status': timing_link['To']['TimingStatus'],
                'stop_from_sequence_number': stop_from_sequence_number,
                'stop_to_sequence_number': stop_to_sequence_number,
                'run_time': xml_timedelta_to_python(timing_link['RunTime']),
                'wait_time': wait_time,
                'section_id': section['@id']
            })

        section_objects[section['@id']] = section_timing_links

    return section_objects

##################################################################################
# Parse <JourneyPattern> elements
#
# returns a dictionary:
#   JourneyPattern_id: [ list of JourneyPatternSection identifiers ]
#
##################################################################################
def parse_journey_patterns(xml_content):
    # Journey Pattern
    patterns = xml_content['TransXChange']['Services']['Service']['StandardService']['JourneyPattern']
    if patterns.__class__ is not list:
        patterns = list([patterns])

    pattern_objects = {}

    for pattern in patterns:
        sections = []
        # Get list of JourneyPatternTimingLink elements within this JourneyPatternSection
        section_refs = pattern['JourneyPatternSectionRefs']
        if section_refs.__class__ is not list:
            section_refs = list([section_refs])

        for section_ref in section_refs:
            sections.append(section_ref)

        direction = None
        if "Direction" in pattern:
            direction = pattern['Direction']

        pattern_objects[pattern['@id']] = { 'direction': direction, 'sections': sections }

    return pattern_objects

##################################################################################
# Parse and return list of <VehicleJourney> elements
#
##################################################################################
def parse_vehicle_journeys(tnds_zone, xml_content, line, journey_pattern_objects):
    # Make list of <VehicleJourney> elements from xmltodict(TNDS xml)
    journeys = xml_content['TransXChange']['VehicleJourneys']['VehicleJourney']
    journeys = list([journeys]) if journeys.__class__ is not list else journeys

    order_journey = 1 # ijl20? not sure why we have this

    # Lists to collect all VehicleJourneys and their SpecialDaysOperation objects
    vehicle_journey_objects = []
    special_days_operation = []

    for journey in journeys:
        service_code = journey['ServiceRef']
        # Make globally unique identifier for this VehicleJourney
        # Note pre Oct 2020 we used <PrivateCode> as the globally unique identifier
        vehicle_journey_id = tnds_zone+'-'+service_code+'-'+journey['VehicleJourneyCode']
        regular_days = []
        nonoperation_bank_holidays = []
        operation_bank_holidays = []

        # Find a 'parent' VehicleJourney if there is one
        if 'VehicleJourneyRef' in journey:
            vehicle_journey_ref = journey['VehicleJourneyRef']
            # OK, now we need to search for the VehicleJourney with (its VehicleJourneyCode)==(this VehicleJourneyRef)
            parent_found = None
            for parent_journey in journeys:
                if parent_journey['VehicleJourneyCode'] == vehicle_journey_ref:
                    #DEBUG
                    #print("Matched VehicleJourney {} to parent {}".format(vehicle_journey_id, vehicle_journey_ref))
                    parent_found = parent_journey
                    break
        ######################################################
        # JourneyPattern
        # Find JourneyPattern id within VehicleJourney element
        # If it's not in there, we'll try again with the 'parent' VehicleJourney via VehicleJourneyRef
        journey_pattern_ref = None
        if 'JourneyPatternRef' in journey:
            journey_pattern_ref = journey['JourneyPatternRef']

        if journey_pattern_ref is None and parent_found is not None and 'JourneyPatternRef' in parent_found:
            journey_pattern_ref = parent_found['JourneyPatternRef']

        if journey_pattern_ref is None:
            logger.error("VehicleJourney {} no JourneyPattern".format(vehicle_journey_id))
            continue # This VehicleJourney is useless if there's no JourneyPattern

        journey_pattern = journey_pattern_objects[journey_pattern_ref]

        ######################################################
        # direction from JourneyPattern
        ######################################################
        direction = journey_pattern['direction']

        # OperatingProfile
        # Find the OperatingProfile, which may be in *this* <VehicleJourney> or in parent via its <VehicleJourneyRef>
        operating_profile = None
        if 'OperatingProfile' in journey:
            operating_profile = journey['OperatingProfile']

        if operating_profile is None and parent_found is not None and 'OperatingProfile' in parent_found:
            operating_profile = parent_found['OperatingProfile']

        # If we have an OperatingProfile then process it, otherwise just skip it.
        if operating_profile is not None:
            if 'RegularDayType' in operating_profile and 'DaysOfWeek' in operating_profile['RegularDayType']:
                week_days_element = operating_profile['RegularDayType']['DaysOfWeek']
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
            if 'SpecialDaysOperation' in operating_profile:
                if 'DaysOfNonOperation' in operating_profile['SpecialDaysOperation'] and operating_profile['SpecialDaysOperation']['DaysOfNonOperation']:
                    noopdays = operating_profile['SpecialDaysOperation']['DaysOfNonOperation']['DateRange']
                    noopdays = list([noopdays]) if noopdays.__class__ is not list else noopdays
                    nonoperation_days = []
                    for noopday in noopdays:
                        if noopday['StartDate'] <= noopday['EndDate']: # bad dates can be a bug in some TNDS XML files
                            nonoperation_days.append(SpecialDaysOperation(
                                vehicle_journey_id=vehicle_journey_id,
                                days=DateRange(lower=noopday['StartDate'],
                                                upper=noopday['EndDate'],
                                                bounds="[]"),
                                operates=False))
                        else:
                            logger.error("VehicleJourney {} bad DateRange in DaysOfNonOperation".format(vehicle_journey_id))
                    special_days_operation += nonoperation_days

                if 'DaysOfOperation' in operating_profile['SpecialDaysOperation'] and operating_profile['SpecialDaysOperation']['DaysOfOperation']:
                    opdays = operating_profile['SpecialDaysOperation']['DaysOfOperation']['DateRange']
                    opdays = list([opdays]) if opdays.__class__ is not list else opdays
                    operation_days = []
                    for opday in opdays:
                        if opday['StartDate'] <= opday['EndDate']: # bad dates can be a bug in some TNDS XML files
                            operation_days.append(SpecialDaysOperation(
                                vehicle_journey_id=vehicle_journey_id,
                                days=DateRange(lower=opday['StartDate'],
                                               upper=opday['EndDate'],
                                               bounds="[]"),
                                operates=True))
                        else:
                            logger.error("VehicleJourney {} bad DateRange in DaysOfOperation".format(vehicle_journey_id))
                    special_days_operation += operation_days

            # Bank Holidays
            if 'BankHolidayOperation' in operating_profile:
                if 'DaysOfNonOperation' in operating_profile['BankHolidayOperation'] and operating_profile['BankHolidayOperation']['DaysOfNonOperation']:
                    nonoperation_bank_holidays = list(
                        operating_profile['BankHolidayOperation']['DaysOfNonOperation'].keys())
                if 'DaysOfOperation' in operating_profile['BankHolidayOperation'] and operating_profile['BankHolidayOperation']['DaysOfOperation']:
                    operation_bank_holidays = list(
                        operating_profile['BankHolidayOperation']['DaysOfOperation'].keys())

        vehicle_journey_objects.append(VehicleJourney(
            id = vehicle_journey_id,
            journey_pattern_ref = journey_pattern_ref, # we used to link to a JourneyPattern object here
            departure_time = dt.strptime(journey['DepartureTime'],'%H:%M:%S').time(),
            days_of_week = ' '.join(regular_days),
            nonoperation_bank_holidays = ' '.join(nonoperation_bank_holidays),
            operation_bank_holidays = ' '.join(operation_bank_holidays),
            line = line,
            direction = direction,
            order=order_journey)
        )
        order_journey += 1

    return vehicle_journey_objects, special_days_operation

#################################################################
# make list of TimetableStops for list of VehicleJourney objects
#################################################################
def timetable_stops(vehicle_journey_objects, journey_pattern_objects, journey_pattern_section_objects):
    timetable_stop_objects = []
    for vehicle_journey in vehicle_journey_objects:
        #DEBUG
        #print("VehicleJourney {}".format(vehicle_journey.id))
        departure_time = datetime.datetime.combine(datetime.date(1, 1, 1), vehicle_journey.departure_time)
        # get list of journey_pattern_section_refs
        section_refs = journey_pattern_objects[vehicle_journey.journey_pattern_ref]['sections']
        #DEBUG
        #print("section_refs {}".format(section_refs))
        order = 1
        for section_ref in section_refs:
            # get list of timing links
            timing_links = journey_pattern_section_objects[section_ref]
            if timing_links:
                for timing_link in timing_links:
                    timetable_stop_objects.append(TimetableStop(
                        vehicle_journey = vehicle_journey,
                        stop_id = timing_link['stop_from_id'],
                        time = departure_time.time(),
                        run_time = timing_link['run_time'],
                        wait_time = timing_link['wait_time'],
                        order = order))
                    departure_time += timing_link['run_time']
                    if timing_link['wait_time']:
                        departure_time += timing_link['wait_time']
                    order += 1

        # Add 'last' stop, i.e. the 'stop_to' in the final timing_link
        timetable_stop_objects.append(TimetableStop(
                vehicle_journey = vehicle_journey,
                stop_id = timing_link['stop_to_id'],
                time = departure_time.time(),
                run_time = timing_link['run_time'],
                wait_time = timing_link['wait_time'],
                order=order,
                last_stop=True))

    return timetable_stop_objects

###############################################################
# Load the XML content for a single service (i.e. TNDS file)
###############################################################
def load_xml(tnds_zone, xml_file):
    xml_content = xmltodict.parse(xml_file)

    if xml_content['TransXChange']['Services']['Service'].get('Mode')  not in ["bus", "coach"]:
        return

    # Create Operator record in PostgreSQL
    bus_operator = load_operator(xml_content) # Update database Operator

    service = xml_content['TransXChange']['Services']['Service']

    # Create Line record in PostgreSQL
    line = load_line(tnds_zone, xml_content, bus_operator, service) # Update database Line

    service_code = service['ServiceCode'] # will re-use for Route
    #DEBUG
    #print("Loading {}".format(service_code))

    # Create Route records in PostgreSQL
    load_routes(tnds_zone, service_code, xml_content, line)

    # Build dictionary of journey_pattern_sections
    journey_pattern_section_objects = parse_journey_pattern_sections(xml_content)

    #print(section_objects)

    # Build dictionary of journey_patterns
    journey_pattern_objects = parse_journey_patterns(xml_content)

    #print(journey_pattern_objects)

    vehicle_journey_objects, special_days_operation = parse_vehicle_journeys(tnds_zone, xml_content, line, journey_pattern_objects)
    if vehicle_journey_objects:
        VehicleJourney.objects.filter(id__in=[vj.id for vj in vehicle_journey_objects]).delete()
        VehicleJourney.objects.bulk_create(vehicle_journey_objects)
    if special_days_operation:
        SpecialDaysOperation.objects.filter(id__in=[vj.id for vj in special_days_operation]).delete()
        SpecialDaysOperation.objects.bulk_create(special_days_operation)

    timetable_stop_objects = timetable_stops(vehicle_journey_objects, journey_pattern_objects, journey_pattern_section_objects)
    if timetable_stop_objects:
        TimetableStop.objects.filter(id__in=[ts.id for ts in timetable_stop_objects]).delete()
        TimetableStop.objects.bulk_create(timetable_stop_objects)

###########################################################################################
##### The manage.py Command class                 #########################################
###########################################################################################

class Command(BaseCommand):
    help = "Updates database from TNDS XML files via ftp or local files. No arguments === --loadftp."

    def add_arguments(self, parser):

        parser.add_argument(
            '--loadzip',
            help='Load TNDS Zip file into database, e.g. update_bus_info --zone EA --loadzip EA.zip',
        )

        parser.add_argument(
            '--loadxml',
            help='Load XML file into database, requires zone, e.g. update_bus_info --zone EA --loadxml cambs_SCCM_4_20004_.xml',
        )

        parser.add_argument(
            '--zone',
            default='TNDS_ZONE',
            help='Specify TNDS zone for XML file, e.g. --zone EA, see --loadzml and --loadzip',
        )

        parser.add_argument(
            '--loadftp',
            nargs='?',
            const='NO ARGS',
            help='Load timetables info from TNDS ftp',
        )

        parser.add_argument(
            '--clear',
            nargs='?',
            const='NO ARGS',
            help='Clear timetables info from database',
        )

        parser.add_argument(
            '--status',
            nargs='?',
            const='NO ARGS',
            help='Show database status for TNDS timetable data',
        )

    def handle(self, **options):

        if options['loadxml']:
            filename = options['loadxml']
            tnds_zone = options['zone']
            #print('loading {}'.format(filename))
            load_xml_file(tnds_zone, filename)
            return

        if options['loadzip']:
            filename = options['loadzip']
            tnds_zone = options['zone']
            #print('loading {}'.format(filename))
            load_zip_file(tnds_zone, filename)
            return

        if options['loadftp']:
            #print('loading timetables from TNDS')
            load_ftp()
            return

        if options['clear']:
            #print('clearing timetable data from database')
            cmd_clear()
            return

        if options['status']:
            #print('Showing timetable data status in database')
            cmd_status()
            return

        # if we fell through to here, then do --loadftp
        load_ftp()
