import logging
import re
import xmltodict
import zipfile
from datetime import timedelta
from django.core.management import BaseCommand
from io import BytesIO
from urllib.request import urlopen
from django.conf import settings
from django.db import transaction
from transport.models import *


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
        traveline_zip_file = zipfile.ZipFile(BytesIO(urlopen('ftp://%s:%s@ftp.tnds.basemap.co.uk/EA.zip' %
                                                             (settings.TNDS_USERNAME, settings.TNDS_PASSWORD)).read()))
        Operator.objects.all().delete()
        Line.objects.all().delete()
        Route.objects.all().delete()
        JourneyPattern.objects.all().delete()
        JourneyPatternSection.objects.all().delete()
        JourneyPatternTimingLink.objects.all().delete()
        VehicleJourney.objects.all().delete()
        Timetable.objects.all().delete()

        for filename in traveline_zip_file.namelist():
            logger.info("Processing file %s" % filename)
            try:
                with traveline_zip_file.open(filename) as xml_file:
                    content = xmltodict.parse(xml_file)

                    if content['TransXChange']['Services']['Service']['Mode'] == "bus":
                        # Operator
                        operator = content['TransXChange']['Operators']['Operator']
                        bus_operator, created = Operator.objects.update_or_create(id=operator['@id'], defaults={
                            'code': operator['OperatorCode'],
                            'short_name': operator['OperatorShortName'],
                            'trading_name': operator['TradingName']
                        })

                        # Service / Line
                        service = content['TransXChange']['Services']['Service']
                        bus_line, created = Line.objects.update_or_create(id=service['ServiceCode'], defaults={
                            'line_name': service['Lines']['Line']['LineName'],
                            'description': service['Description'],
                            'operator': bus_operator,
                            'standard_origin': service['StandardService']['Origin'],
                            'standard_destination': service['StandardService']['Destination'],
                            'start_date': service['OperatingPeriod']['StartDate'],
                            'end_date': service['OperatingPeriod']['EndDate'],
                            'regular_days_of_week':
                                list(service['OperatingProfile']['RegularDayType']['DaysOfWeek'].keys())
                            if 'OperatingProfile' in service and 'RegularDayType' in service['OperatingProfile'] else ('MondayToFriday',),
                            'bank_holiday_operation':
                                list(service['OperatingProfile']['BankHolidayOperation']['DaysOfNonOperation'].keys())
                            if 'OperatingProfile' in service and 'BankHolidayOperation' in service['OperatingProfile'] else None
                        })

                        # Routes
                        routes = content['TransXChange']['RouteSections']['RouteSection']
                        if routes.__class__ is not list:
                            routes = list([routes])
                            routes_desc = list([content['TransXChange']['Routes']['Route']])
                        else:
                            routes_desc = content['TransXChange']['Routes']['Route']
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
                            Route.objects.update_or_create(id=routes_desc[route_id]['@id'], line=bus_line, defaults={
                                'stops_list': ','.join(stops),
                                'description': routes_desc[route_id]['Description']
                            })

                        # Journey Pattern Sections
                        journey_pattern_sections = \
                            content['TransXChange']['JourneyPatternSections']['JourneyPatternSection']
                        if journey_pattern_sections.__class__ is not list:
                            journey_pattern_sections = list([journey_pattern_sections])
                        for journey_pattern_section in journey_pattern_sections:
                            JourneyPatternSection.objects.update_or_create(id=journey_pattern_section['@id'])
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
                                JourneyPatternTimingLink.objects.update_or_create(
                                    id=journey_pattern_timing_link['@id'],
                                    defaults={
                                        'stop_from_id': journey_pattern_timing_link['From']['StopPointRef'],
                                        'stop_to_id': journey_pattern_timing_link['To']['StopPointRef'],
                                        'stop_from_timing_status': journey_pattern_timing_link['From']['TimingStatus'],
                                        'stop_to_timing_status': journey_pattern_timing_link['To']['TimingStatus'],
                                        'stop_from_sequence_number': journey_pattern_timing_link['From']['@SequenceNumber'],
                                        'stop_to_sequence_number': journey_pattern_timing_link['To']['@SequenceNumber'],
                                        'run_time': xml_timedelta_to_python(journey_pattern_timing_link['RunTime']),
                                        'wait_time': wait_time,
                                        'journey_pattern_section_id': journey_pattern_section['@id']
                                    })

                        # Journey Pattern
                        journey_patterns = \
                            content['TransXChange']['Services']['Service']['StandardService']['JourneyPattern']
                        if journey_patterns.__class__ is not list:
                            journey_patterns = list([journey_patterns])
                        for journey_pattern in journey_patterns:
                            JourneyPattern.objects.update_or_create(id=journey_pattern['@id'],
                                                                    defaults=
                                                                    {'direction': journey_pattern['Direction'],
                                                                     'route_id': journey_pattern['RouteRef'],
                                                                     'section_id':
                                                                         journey_pattern['JourneyPatternSectionRefs']})

                        # Journey
                        journeys = content['TransXChange']['VehicleJourneys']['VehicleJourney']
                        if journeys.__class__ is not list:
                            journeys = list([journeys])
                        order_journey = 1
                        for journey in journeys:
                            if 'OperatingProfile' not in journey:
                                days_of_week = None
                            elif 'DaysOfWeek' in journey['OperatingProfile']['RegularDayType']:
                                days_of_week = list(journey['OperatingProfile']['RegularDayType']['DaysOfWeek'].keys())[0]
                            elif 'HolidaysOnly' in journey['OperatingProfile']['RegularDayType']:
                                days_of_week = "HolidaysOnly"
                                # TODO Store which days
                            else:
                                days_of_week = None
                                print(journey)
                            vehicle_journey, created = VehicleJourney.objects.update_or_create(
                                id=journey['PrivateCode'], defaults={
                                    'journey_pattern_id': journey['JourneyPatternRef'],
                                    'departure_time': journey['DepartureTime'],
                                    'days_of_week': days_of_week,
                                    'order': order_journey # trasxchange specifies that the order of the journeys in the
                                    # xml is how journeys have to be shown
                                })
                            order_journey += 1

                    for vh in VehicleJourney.objects.all():
                        vh.generate_timetable()
                    xml_file.close()
            except Exception as e:
                logger.error("Error while trying to process file %s, exception was %s" % (filename, e))
