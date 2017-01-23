import xmltodict
from os import listdir
from django.core.management.base import NoArgsCommand
from os.path import isfile, join
from realtime.models import BusLine, BusOperator, BusRoute, BusJourney, BusJourneyPatternSection, BusJourneyPattern


class Command(NoArgsCommand):
    help = "Updates bus data from XML files from TravelLine website"

    def add_arguments(self, parser):
        parser.add_argument('xml_folder_path')

    def handle(self, *args, **options):
        for file in listdir(options['xml_folder_path']):
            if isfile(join(options['xml_folder_path'], file)) and file.endswith('.xml'):
                xml_file = open(join(options['xml_folder_path'], file), 'rb')
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
                        'standard_destination': service['StandardService']['Destination']
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
                            for stop in route['RouteLink']:
                                # TODO check if To from next item and From from current are the same
                                stops.append(stop['From']['StopPointRef'])
                            stops.append(route['RouteLink'][-1]['To']['StopPointRef'])
                        else:
                            stops.append(route['RouteLink']['From']['StopPointRef'])
                            stops.append(route['RouteLink']['To']['StopPointRef'])
                        BusRoute.objects.update_or_create(id=routes_desc[route_id]['@id'], line=bus_line, defaults={
                            'stops_list': ','.join(stops),
                            'description': routes_desc[route_id]['Description']
                        })

                    # Journey Pattern Sections
                    journey_pattern_sections = \
                        content['TransXChange']['JourneyPatternSections']['JourneyPatternSection']
                    if journey_pattern_sections.__class__ is not list:
                        journey_pattern_sections = list([journey_pattern_sections])
                    for journey_pattern_section in journey_pattern_sections:
                        stops = []
                        if journey_pattern_section['JourneyPatternTimingLink'].__class__ is list:
                            for stop in journey_pattern_section['JourneyPatternTimingLink']:
                                # TODO check if To from next item and From from current are the same
                                stops.append(stop['From']['StopPointRef'])
                            stops.append(journey_pattern_section['JourneyPatternTimingLink'][-1]['To']['StopPointRef'])
                        else:
                            stops.append(journey_pattern_section['JourneyPatternTimingLink']['From']['StopPointRef'])
                            stops.append(journey_pattern_section['JourneyPatternTimingLink']['To']['StopPointRef'])
                        BusJourneyPatternSection.objects.update_or_create(id=journey_pattern_section['@id'],
                                                                          line=bus_line,
                                                                          defaults={'stops_list': ','.join(stops)})

                    # Journey Pattern
                    journey_patterns = \
                        content['TransXChange']['Services']['Service']['StandardService']['JourneyPattern']
                    if journey_patterns.__class__ is not list:
                        journey_patterns = list([journey_patterns])
                    for journey_pattern in journey_patterns:
                        BusJourneyPattern.objects.update_or_create(id=journey_pattern['@id'],
                                                                   defaults=
                                                                   {'direction': journey_pattern['Direction'],
                                                                    'route': BusRoute.objects.get
                                                                    (id=journey_pattern['RouteRef']),
                                                                    'section': BusJourneyPatternSection.objects.get
                                                                    (id=journey_pattern['JourneyPatternSectionRefs'])})

                    # Journey
                    journeys = content['TransXChange']['VehicleJourneys']['VehicleJourney']
                    if journeys.__class__ is not list:
                        journeys = list([journeys])
                    for journey in journeys:
                        BusJourney.objects.update_or_create(id=journey['PrivateCode'], line=bus_line, defaults={
                            'pattern': BusJourneyPattern.objects.get(id=journey['JourneyPatternRef']),
                            'departure_time': journey['DepartureTime'],
                        })

                xml_file.close()
