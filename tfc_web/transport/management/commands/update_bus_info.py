import os
import logging
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from django.db import transaction
from django.utils.timezone import is_naive, make_aware
from django.core.management import BaseCommand
from urllib.request import urlretrieve
from django.conf import settings
from django.db import transaction
from transport.models import TransXChange, Operator, Service, JourneyPattern, Stop, VehicleJourney, JourneyPatternTimingLink, Line
from transport.api.views import DAYS
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
    Operator.objects.all().delete()
    Line.objects.all().delete()
    VehicleJourney.objects.all().delete()


###############################################################
# manage.py timetable --status
# give info regarding status of TNDS data in PostgreSQL
###############################################################
def cmd_status():
    print("Operator objects: {}".format(Operator.objects.all().count()))
    print("Service objects: {}".format(Service.objects.all().count()))
    print("Line objects: {}".format(Line.objects.all().count()))
    print("VehicleJourney objects: {}".format(VehicleJourney.objects.all().count()))
    print("TransXChange objects: {}".format(TransXChange.objects.all().count()))
    print("Latest update: {}".format(TransXChange.objects.latest('modification_date_time').modification_date_time))

###############################################################
# Load TNDS XML data file into PostgreSQL from filesystem
###############################################################
def load_xml_file(tnds_zone, filename):
    #print('load_xml_file loading {} {}'.format(tnds_zone, filename))
    try:
        with open(filename) as xml_file:
            with transaction.atomic():
                load_xml(tnds_zone, filename, xml_file.read())
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
                        load_xml(tnds_zone, filename, xml_file.read())
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
# Create XML -> Stops object in PostgreSQL and return it
###############################################################
def load_stops(root, ns, tx):
    # We collect the list of all stop id in the XML file
    stop_ids = []
    stops = []
    for stop_node in root.findall('.//ns:AnnotatedStopPointRef', ns):
        atco_code = stop_node.find('ns:StopPointRef', ns).text
        stop_ids.append(atco_code)

        stop = Stop(
            atco_code = atco_code,
            common_name = stop_node.findtext('ns:CommonName', namespaces=ns),
            locality_name = stop_node.findtext('ns:LocalityName', namespaces=ns),
            longitude = stop_node.findtext('ns:Location/ns:Longitude', namespaces=ns),
            latitude = stop_node.findtext('ns:Location/ns:Latitude', namespaces=ns)
        )
        stops.append(stop)

    existing_stops = Stop.objects.filter(atco_code__in=stop_ids).values_list('atco_code', flat=True)
    stop_ids_that_need_importing = set(stop_ids).difference(set(existing_stops))
    
    for stop in stops:
        if stop.atco_code in stop_ids_that_need_importing:
            try:
                stop.save()
            except Exception as e:
                print('Stop save error in {} for {} lat={}, lng={}'.format(tx.file_name, stop.atco_code,stop.latitude, stop.longitude))
                raise e


###############################################################
# Create XML -> Operator object in PostgreSQL and return it
###############################################################
def load_operators(root, ns):
    for operator_node in root.findall('.//ns:Operator', ns):
        operator, created = Operator.objects.update_or_create(
            operator_id=operator_node.attrib.get('id'),
            defaults={
                'operator_code': operator_node.findtext('ns:OperatorCode', namespaces=ns),
                'operator_short_name': operator_node.findtext('ns:OperatorShortName', namespaces=ns),
                'operator_name': operator_node.findtext('ns:OperatorNameOnLicence', namespaces=ns),
                'trading_name': operator_node.findtext('ns:TradingName', namespaces=ns),
                'contact_phone': operator_node.findtext('ns:ContactDetails/ns:PhoneNumber', namespaces=ns),
                'contact_email': operator_node.findtext('ns:ContactDetails/ns:Email', namespaces=ns),
                'contact_url': operator_node.findtext('ns:ContactDetails/ns:Url', namespaces=ns),
                'national_operator_code': operator_node.findtext('ns:NationalOperatorCode', namespaces=ns),
                'license_number': operator_node.findtext('ns:LicenceNumber', namespaces=ns),
                'license_expiry_date': datetime.strptime(operator_node.findtext('ns:OperatorLicence/ns:EffectiveToDate', namespaces=ns), '%Y-%m-%d') if operator_node.findtext('ns:OperatorLicence/ns:EffectiveToDate', namespaces=ns) is not None else None,
                'street': operator_node.findtext('ns:OperatorAddress/ns:AddressLine1', namespaces=ns),
                'locality': operator_node.findtext('ns:OperatorAddress/ns:AddressLine2', namespaces=ns),
                'town': operator_node.findtext('ns:OperatorAddress/ns:Town', namespaces=ns),
                'postcode': operator_node.findtext('ns:OperatorAddress/ns:PostCode', namespaces=ns)
            }
        )
    return operator


#################################################################
# Create XML -> Service and JourneyPattern objects in PostgreSQL
#################################################################
def load_services_and_journeys(root, ns, tx):

    #print('load_services_and_journeys() tx={}'.format(tx));

    # Create Service objects
    for service_node in root.findall('.//ns:Service', ns):
        service_code = service_node.findtext('ns:ServiceCode', namespaces=ns)

        #print('load_services_and_journeys(): service_code={}'.format(service_code))

        for line_node in service_node.findall('.//ns:Line', ns):
            line_id = service_code + line_node.attrib['id']
            #print('load_services_and_journeys(): line_id={}'.format(line_id))
            line, created = Line.objects.update_or_create(
                line_id=line_id,
                defaults={
                    'line_name': line_node.findtext('ns:LineName', namespaces=ns),
                    'description': line_node.findtext('ns:Description', namespaces=ns),
                    'transport_mode': line_node.findtext('ns:TransportMode', namespaces=ns),
                    'private_code': line_node.findtext('ns:PrivateCode', namespaces=ns),
                }
            )

        #print('load_services_and_journeys(): update_or_create(service_code={})'.format(service_code))
        service, created = Service.objects.update_or_create(
            #tx = tx,
            service_code = service_code,
            defaults=dict(
                tx = tx,
                operating_period_start = datetime.fromisoformat(service_node.find('ns:OperatingPeriod/ns:StartDate', ns).text) if service_node.find('ns:OperatingPeriod/ns:StartDate', ns) is not None else None,
                operating_period_end = datetime.fromisoformat(service_node.find('ns:OperatingPeriod/ns:EndDate', ns).text) if service_node.find('ns:OperatingPeriod/ns:EndDate', ns) is not None else None,
                registered_travel_mode = service_node.findtext('ns:RegisteredTravelMode', namespaces=ns),
                description = service_node.findtext('ns:Description', namespaces=ns),
                standard_origin = service_node.findtext('ns:StandardService/ns:Origin', namespaces=ns),
                standard_destination = service_node.findtext('ns:StandardService/ns:Destination', namespaces=ns),
                operator_id = service_node.findtext('ns:RegisteredOperatorRef', namespaces=ns),
                line = line
            )
        )
        
        # EXAMPLE 1

        # <JourneyPattern id="jp_1">
        #   <DestinationDisplay>St Neots, Market Square</DestinationDisplay>
        #   <OperatorRef>tkt_oid</OperatorRef>
        #   <Direction>outbound</Direction>
        #   <RouteRef>rt_0000</RouteRef>
        #   <JourneyPatternSectionRefs>js_1</JourneyPatternSectionRefs>
        # </JourneyPattern>

        # <JourneyPattern id="JP1">
        #   <DestinationDisplay>Trumpington Trumpington Park-and-Ride</DestinationDisplay>
        #   <Direction>outbound</Direction>
        #   <RouteRef>RT74</RouteRef>
        #   <JourneyPatternSectionRefs>JPS151</JourneyPatternSectionRefs>
        # </JourneyPattern>

        # <Route id="RT74">
        # <PrivateCode>PR3-74</PrivateCode>
        # <Description>Downing Street - Trumpington Trumpington Park-and-Ride</Description>
        # <RouteSectionRef>RS2</RouteSectionRef>
        # </Route>


        # EXAMPLE 2

        #    <JourneyPatternTimingLink id="jptl_13">
        #     <From SequenceNumber="4">
        #       <StopPointRef>0500CCITY273</StopPointRef>
        #       <TimingStatus>otherPoint</TimingStatus>
        #     </From>
        #     <To SequenceNumber="5">
        #       <StopPointRef>0500CCITY400</StopPointRef>
        #       <TimingStatus>otherPoint</TimingStatus>
        #     </To>
        #     <RouteLinkRef>rl_0001_4</RouteLinkRef>
        #     <RunTime>PT1M</RunTime>
        #   </JourneyPatternTimingLink>

        #   <RouteLink id="RL1">
        #     <From>
        #       <StopPointRef>0500CCITY464</StopPointRef>
        #     </From>
        #     <To>
        #       <StopPointRef>0500CCITY320</StopPointRef>
        #     </To>
        #     <Distance>376</Distance>
        #     <Direction>outbound</Direction>
        #   </RouteLink>


        # Create JourneyPattern objects
        for journey_pattern_node in service_node.findall('.//ns:JourneyPattern', ns):
            route_id = getattr(journey_pattern_node.find('ns:RouteRef', ns), 'text', None)
            route_node = root.find(f'.//ns:Route[@id="{route_id}"]', ns)

            journey_pattern, created = JourneyPattern.objects.update_or_create(
                jp_id = journey_pattern_node.attrib['id'],
                service=service,
                defaults={
                    'destination_display': journey_pattern_node.findtext('ns:DestinationDisplay', namespaces=ns),  
                    'direction': journey_pattern_node.findtext('ns:Direction', namespaces=ns),
                    'route_private_code': route_node.findtext('ns:PrivateCode', namespaces=ns) if route_node is not None else None,
                    'route_description': route_node.findtext('ns:Description', namespaces=ns) if route_node is not None else None
                }
            )

            order = 1
            for jptl_id in journey_pattern_node.findall('ns:JourneyPatternSectionRefs', ns):
                jptl_id = jptl_id.text
                for jptl_node in root.findall(f'.//ns:JourneyPatternSection[@id="{jptl_id}"]/ns:JourneyPatternTimingLink', ns):
                    from_node = jptl_node.find('ns:From', ns)
                    to_node = jptl_node.find('ns:To', ns)
                    route_link_id = getattr(jptl_node.find('ns:RouteLinkRef', ns), 'text', None)
                    route_link_node = root.find(f'.//ns:RouteLink[@id="{route_link_id}"]', ns)

                    jptl, created = JourneyPatternTimingLink.objects.update_or_create(
                        jptl_id = jptl_node.attrib['id'],
                        jp=journey_pattern,
                        defaults={
                            'order': order,
                            'from_display': from_node.findtext('ns:DynamicDestinationDisplay', namespaces=ns),
                            'from_stop_id': from_node.findtext('ns:StopPointRef', namespaces=ns),
                            'from_timing_status': from_node.findtext('ns:TimingStatus', namespaces=ns),
                            'from_sequence_number': from_node.attrib['SequenceNumber'] if 'SequenceNumber' in from_node.attrib else None,
                            'to_display': to_node.findtext('ns:DynamicDestinationDisplay', namespaces=ns),
                            'to_stop_id': to_node.findtext('ns:StopPointRef', namespaces=ns),
                            'to_timing_status': to_node.findtext('ns:TimingStatus', namespaces=ns),
                            'to_sequence_number': to_node.attrib['SequenceNumber'] if 'SequenceNumber' in to_node.attrib else None,
                            'run_time': jptl_node.findtext('ns:RunTime', namespaces=ns),
                            'distance': route_link_node.findtext('ns:Distance', namespaces=ns) if route_link_node is not None else None,
                            'direction': route_link_node.findtext('ns:Direction', namespaces=ns) if route_link_node is not None else None
                        }
                    )
                    order += 1
            
            journey_pattern.update_coordinates()


###############################################################
# Create XML -> VehicleJourney objects in PostgreSQL
###############################################################
def load_vehicle_journeys(root, ns, tx):

    # Create VehicleJourney objects
    for vj_node in root.findall('.//ns:VehicleJourney', ns):
        service_ref = vj_node.findtext('ns:ServiceRef', namespaces=ns)
        line_ref = vj_node.findtext('ns:LineRef', namespaces=ns)
        service = Service.objects.get(service_code=service_ref)

        vehicle_journey_code = vj_node.findtext('ns:VehicleJourneyCode', namespaces=ns)
        vehicle_journey_id = vj_node.findtext('ns:VehicleJourneyId', namespaces=ns)

        departure_time = vj_node.findtext('ns:DepartureTime', namespaces=ns)

        direction = vj_node.findtext('ns:Direction', namespaces=ns)

        operating_period = vj_node.find('ns:OperatingPeriod', ns)
        start_date = service.operating_period_start
        end_date = service.operating_period_end
        end_date = None
        if operating_period:
            start_date = operating_period.findtext('ns:StartDate', namespaces=ns)
            end_date = operating_period.findtext('ns:EndDate', namespaces=ns)

        operating_profile = vj_node.find('ns:OperatingProfile', ns)
        if operating_profile is None:
            operating_profile = root.find(f'.//ns:Service[ns:ServiceCode = "{service_ref}"]/ns:OperatingProfile', ns)

        days_of_week = {}
        for day, *expressions in DAYS:
            day_lower = day.lower()
            day_active = False
            for expression in expressions:
                if operating_profile.findtext(f'ns:RegularDayType/ns:DaysOfWeek/ns:{expression}', namespaces=ns) is not None:
                    day_active = True
                    break
            days_of_week[day_lower] = day_active

        bank_holiday_operation = operating_profile.find('ns:BankHolidayOperation', ns)
        if bank_holiday_operation is not None:
            bank_holiday_operation = ET.tostring(bank_holiday_operation)

        journey_pattern_ref = vj_node.findtext('ns:JourneyPatternRef', namespaces=ns)
        journey_pattern = JourneyPattern.objects.get(jp_id=journey_pattern_ref, service=service)

        vj, created = VehicleJourney.objects.update_or_create(
            service = service,
            vehicle_journey_code = vehicle_journey_code,
            defaults={
                'journey_pattern': journey_pattern,
                'operator_id': vj_node.findtext('ns:OperatorRef', namespaces=ns),
                'line_id': service_ref+line_ref,
                'direction': direction,
                'service': service,
                'vehicle_journey_id': vehicle_journey_id,
                'departure_time': departure_time,
                'start_date': start_date,
                'end_date': end_date,
                'bank_holiday_operation': bank_holiday_operation,
                **days_of_week
            }
        )

        #   <VehicleJourneys>
        #     <VehicleJourney SequenceNumber="1049">
        #       <PrivateCode>4SU:O:0:3431:t4h-E8L86BA</PrivateCode>
        #       <Direction>inbound</Direction>
        #       <OperatingProfile>
        #         <RegularDayType>
        #           <DaysOfWeek>
        #             <Sunday />....
        #           </DaysOfWeek>
        #         </RegularDayType>
        #         <BankHolidayOperation>
        #           <DaysOfOperation>
        #             <GoodFriday />....
        #           </DaysOfOperation>
        #           <DaysOfNonOperation>
        #             <ChristmasDay />....
        #           </DaysOfNonOperation>
        #         </BankHolidayOperation>
        #       </OperatingProfile>
        #       <VehicleJourneyCode>VJ1049</VehicleJourneyCode>
        #       <ServiceRef>EA_SC_SCCM_4_1</ServiceRef>
        #       <LineRef>SL1</LineRef>
        #       <JourneyPatternRef>JP3</JourneyPatternRef>
        #       <DepartureTime>08:39:00</DepartureTime>
        #     </VehicleJourney>

    return vj


###############################################################
# Load the XML content for a single service (i.e. TNDS file)
###############################################################
def load_xml(tnds_zone, filename, xml_content):
    root = ET.fromstring(xml_content)

    ns = {'ns': 'http://www.transxchange.org.uk/'}

    # ijl20: regex to remove decimal seconds for python 3.10 datetime.fromisoformat()
    p = re.compile('(.*)\.\d+(.*)')
    
    # Get TransXChange model fields
    transxchange = root

    # get CreationDateTime and work around multiple ISO format issues
    creation_time_str = transxchange.attrib.get('CreationDateTime')
    creation_time_str_original = creation_time_str
    m = p.match(creation_time_str)
    if m is not None and len(m.groups()) == 2:
        creation_time_str = m.groups()[0]+m.groups()[1]

    creation_time = datetime.fromisoformat(creation_time_str)

    if is_naive(creation_time):
        creation_time = make_aware(creation_time)

    #print('creation_time {}'.format(creation_time))

    # get ModificationDateTime and work around multiple ISO format issues
    modification_time_str = transxchange.attrib.get('ModificationDateTime')
    modification_time_str_original = modification_time_str
    m = p.match(modification_time_str)
    if m is not None and len(m.groups()) == 2:
        modification_time_str = m.groups()[0]+m.groups()[1]

    modification_time = datetime.fromisoformat(modification_time_str)

    if is_naive(modification_time):
        modification_time = make_aware(modification_time)

    #print('modification_time {}'.format(modification_time))

    schema_version = transxchange.attrib.get('SchemaVersion')
    transxchange_filename = transxchange.attrib.get('FileName') or filename
    revision_number = transxchange.attrib.get('RevisionNumber')

    # Create TransXChange object
    tx, created = TransXChange.objects.update_or_create(
        file_name=transxchange_filename, 
        creation_date_time=creation_time,
        modification_date_time=modification_time, 
        schema_version=schema_version,
        revision_number=revision_number
    )

    #print('transxchange_id: {}, create={}'.format(tx, created))

    # {http://www.transxchange.org.uk/}StopPoints {}
    # {http://www.transxchange.org.uk/}RouteSections {}
    # {http://www.transxchange.org.uk/}Routes {}
    # {http://www.transxchange.org.uk/}JourneyPatternSections {}
    # {http://www.transxchange.org.uk/}Operators {}
    # {http://www.transxchange.org.uk/}Services {}
    # {http://www.transxchange.org.uk/}VehicleJourneys {}

    # {http://www.transxchange.org.uk/}Lines {}
    # {http://www.transxchange.org.uk/}ServiceCode {}
    # {http://www.transxchange.org.uk/}OperatingPeriod {}
    # {http://www.transxchange.org.uk/}OperatingProfile {}
    # {http://www.transxchange.org.uk/}RegisteredOperatorRef {}
    # {http://www.transxchange.org.uk/}PublicUse {}
    # {http://www.transxchange.org.uk/}StandardService {}
   
    #print("load_xml():load_stops");
    load_stops(root, ns, tx)
    #print("load_xml():load_operators");
    load_operators(root, ns)
    #print("load_xml():load_services_and_journeys");
    load_services_and_journeys(root, ns, tx)
    #print("load_xml():load_vehicle_journeys");
    load_vehicle_journeys(root, ns, tx)
    #print("load_xml() completed")

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
            print('loading {}'.format(filename))
            load_xml_file(tnds_zone, filename)
            return

        if options['loadzip']:
            filename = options['loadzip']
            tnds_zone = options['zone']
            print('loading {}'.format(filename))
            load_zip_file(tnds_zone, filename)
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

        # if we fell through to here, then do --loadftp
        load_ftp()
