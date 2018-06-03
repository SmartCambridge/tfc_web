import operator
import re
import json
import coreapi
import coreschema
from datetime import timedelta
from dateutil.parser import parse
from functools import reduce
from os import listdir
from pathlib import Path
from django.db.models import Q
from django.urls import reverse
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, filters
from rest_framework.decorators import api_view, renderer_classes, schema, parser_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer
from rest_framework.response import Response
from rest_framework.schemas import ManualSchema, AutoSchema
from transport.api.serializers import VehicleJourneySerializer, LineSerializer, \
    VehicleJourneySummarisedSerializer, StopSerializer
from transport.models import Stop, Timetable, VehicleJourney
from transport.utils.transxchange import BANK_HOLIDAYS
from urllib.parse import quote


DAYS = [ ['Monday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Tuesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Wednesday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Thursday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Friday', 'MondayToFriday', 'MondayToSaturday', 'MondayToSunday'],
         ['Saturday', 'Weekend', 'MondayToSaturday', 'MondayToSunday'],
         ['Sunday', 'Weekend', 'MondayToSunday'] ]


class Pagination(PageNumberPagination):
    page_size = 25
    max_page_size = 50
    page_size_query_param = 'page_size'


def string_to_datetime(str_time):
    try:
        time = parse(str_time)
    except:
        return None
    return time


def calculate_vehicle_journey(departure_datetime, departure_stop_id, destination_stop_id=None, queryset=False):
    """
    Retrieves a list of possible Vehicle Journeys from a departure time and a bus stop.
    :param departure_datetime:
    :param departure_stop_id:
    :param destination_stop_id:
    :param queryset: returns a queryset if True, a list if not
    :return: list or queryset of Vehicle Journeys
    """
    journey_day_of_week = departure_datetime.date().strftime("%A")
    bank_holidays = []
    if departure_datetime.date() in BANK_HOLIDAYS:
        bank_holidays.append('AllBankHolidays')
        for bank_holiday_day in BANK_HOLIDAYS[departure_datetime.date()]:
            bank_holidays.append(bank_holiday_day)

    if bank_holidays:
        base_query1 = VehicleJourney.objects.filter(
            Q(journey_times__stop_id=departure_stop_id),
            Q(
                # Check if this vehicle operates departure_time's day of the week and departure_time's bank holiday is
                # not in the list of non operation bank holidays nor in the special days of non operation list
                Q(
                    Q(days_of_week__icontains=journey_day_of_week),
                    # Check that all possible names of departure_time's bank holiday do not appear in the non
                    # operation list
                    reduce(operator.and_,
                           [~Q(nonoperation_bank_holidays__icontains=bank_holiday)
                            for bank_holiday in bank_holidays]),
                    # Check that all possible names of departure_time's bank holiday do not appear in the
                    # non special day operation list
                    ~Q(special_days_operation__days__contains=departure_datetime.date(),
                       special_days_operation__operates=False)
                )
                |
                # Check if departure_time is a special day and the vehicle operates in departure_time's bank holiday
                reduce(operator.or_, [Q(operation_bank_holidays__icontains=bank_holiday)
                                      for bank_holiday in bank_holidays])
                |
                # Check if departure_time is a special operation day
                Q(special_days_operation__days__contains=departure_datetime.date(),
                  special_days_operation__operates=True)
            )
        )
    else:
        base_query1 = VehicleJourney.objects.filter(
            Q(journey_times__stop_id=departure_stop_id),
            Q(
                # Check if this vehicle operates departure_time's day of the week and departure_time's bank holiday is
                # not in the list of non operation bank holidays nor in the special days of non operation list
                Q(
                    Q(days_of_week__icontains=journey_day_of_week),
                    # Check that all possible names of departure_time's bank holiday do not appear in the
                    # non special day operation list
                    ~Q(special_days_operation__days__contains=departure_datetime.date(),
                       special_days_operation__operates=False)
                )
                |
                # Check if departure_time is a special operation day
                Q(special_days_operation__days__contains=departure_datetime.date(),
                  special_days_operation__operates=True)
            )
        )
    query1 = base_query1.filter(journey_times__time=departure_datetime.time(), journey_times__order=1)
    if destination_stop_id:
        query1b = base_query1.filter(journey_times__last_stop=True)
        query1 = query1.union(query1b)
    return query1.values_list('id', flat=True) if not queryset else query1


journeys_by_time_and_stop_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "stop_id",
            required=True,
            location="query",
            schema=coreschema.String(description="Stop id atco_code."),
            description="Stop atco_code."
        ),
        coreapi.Field(
            "datetime_from",
            required=False,
            location="query",
            schema=coreschema.String(description="Start datetime or time to give results from. "
                                                 "If time is given insetad of a datetime, "
                                                 "today is used as date. If nothing given, "
                                                 "now is used. The datetime or date must be "
                                                 "given in ISO 8601 format."),
            description="Start datetime or time to give results from. If time is given insetad "
                        "of a datetime, today is used as date. If nothing given, now is used. "
                        "The datetime or date must be given in ISO 8601 format."
        ),
        coreapi.Field(
            "nresults",
            required=False,
            location="query",
            schema=coreschema.Integer(description="Maximum number of journeys to return. 10 by default"),
            description="Maximum number of journeys to return. 10 by default"
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Exdpands the resulted Journey into a full object"
        ),
    ],
    description="Will return the timetable (Journeys) expected for a given stop (stop_id) from a specific date and "
                "time datetime_from (optional, default = now). All results are paginated and a 'next' attribute is "
                "also returned containing the URL to use to retrieve more results. The pagination can return up to n "
                "(page size) results but also less if there are no more results for a day, for example."
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@schema(journeys_by_time_and_stop_schema)
def journeys_by_time_and_stop(request):
    try:
        stop_id = request.GET['stop_id']
    except:
        return Response({"details": "stop_id not present"}, status=400)
    try:
        stop = Stop.objects.get(atco_code=stop_id)
    except:
        return Response({"details": "Stop %s not found" % stop_id}, status=404)
    datetime_from = string_to_datetime(request.GET['datetime_from']) if 'datetime_from' in request.GET else now()
    if not datetime_from:
        return Response({"details": "datetime_from badly formatted"}, status=400)
    try:
        nresults = int(request.GET['nresults']) if 'nresults' in request.GET else 10
    except:
        return Response({"details": "nresults is not an int"}, status=400)
    if nresults < 1:
        return Response({"details": "nresults is should be at least 1"}, status=400)





    journey_day_of_week = datetime_from.date().strftime("%A")
    bank_holidays = []
    if datetime_from.date() in BANK_HOLIDAYS:
        bank_holidays.append('AllBankHolidays')
        for bank_holiday_day in BANK_HOLIDAYS[datetime_from.date()]:
            bank_holidays.append(bank_holiday_day)
        base_query1 = Timetable.objects.filter(
            Q(stop=stop),
            Q(
                # Check if this vehicle operates departure_time's day of the week and departure_time's bank holiday is
                # not in the list of non operation bank holidays nor in the special days of non operation list
                Q(
                    Q(vehicle_journey__days_of_week__icontains=journey_day_of_week),
                    # Check that all possible names of departure_time's bank holiday do not appear in the non
                    # operation list
                    reduce(operator.and_,
                           [~Q(vehicle_journey__nonoperation_bank_holidays__icontains=bank_holiday)
                            for bank_holiday in bank_holidays]),
                    # Check that all possible names of departure_time's bank holiday do not appear in the
                    # non special day operation list
                    ~Q(vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                       vehicle_journey__special_days_operation__operates=False)
                )
                |
                # Check if departure_time is a special day and the vehicle operates in departure_time's bank holiday
                reduce(operator.or_, [Q(vehicle_journey__operation_bank_holidays__icontains=bank_holiday)
                                      for bank_holiday in bank_holidays])
                |
                # Check if departure_time is a special operation day
                Q(vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                  vehicle_journey__special_days_operation__operates=True)
            )
        )
    else:
        base_query1 = Timetable.objects.filter(
            Q(stop=stop),
            Q(
                # Check if this vehicle operates departure_time's day of the week and departure_time's bank holiday is
                # not in the list of non operation bank holidays nor in the special days of non operation list
                Q(
                    Q(vehicle_journey__days_of_week__icontains=journey_day_of_week),
                    # Check that all possible names of departure_time's bank holiday do not appear in the
                    # non special day operation list
                    ~Q(vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                       vehicle_journey__special_days_operation__operates=False)
                )
                |
                # Check if departure_time is a special operation day
                Q(vehicle_journey__special_days_operation__days__contains=datetime_from.date(),
                  vehicle_journey__special_days_operation__operates=True)
            )
        )
    query1 = base_query1.filter(time__gte=datetime_from.time())
    # We fetch an extra entry to see if there are more than one bus leaving at the same hour,
    # to calculate next_datetime correctly
    timetable = list(query1.prefetch_related('vehicle_journey__journey_pattern__route__line')
                     .order_by('time')[:nresults+1])

    if len(timetable) < nresults:
        # no more results for the current day selected
        next_datetime = datetime_from.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    else:
        while timetable[-1].time == timetable[-2].time and len(timetable) > 2:
            # Remove from the result entries with the same leaving time
            timetable = timetable[:-1]
        if timetable[-1].time == timetable[-2].time and len(timetable) == 2:
            # Exceptional case where all entries have the same leaving time, in this case we return 0 results and
            # increase the nresult of the next query
            next_datetime = timetable[-1].time
            nresults += 1
            timetable = []
        else:
            # Remove the last entry that was only used to see if there are buses leaving at the same time
            next_datetime = timetable[-1].time
            timetable = timetable[:-1]

    results_json = {'results': []}
    for result in timetable:
        results_json['results'].append(
            {'time': result.time,
             'journey': VehicleJourneySummarisedSerializer(result.vehicle_journey).data
             if request.GET.get('expand_journey', 'false').lower() == 'true' else result.vehicle_journey.id,
             'line': LineSerializer(result.vehicle_journey.journey_pattern.route.line).data})

    results_json['next'] = "%s?stop_id=%s&datetime_from=%s&nresults=%s&expand_journey=%s" % \
                           (reverse(journeys_by_time_and_stop), stop_id, quote(next_datetime.isoformat()), nresults,
                            request.GET.get('expand_journey', 'false'))
    return Response(results_json)


departure_to_journey_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "departure_stop_id",
            required=True,
            location="query",
            schema=coreschema.String(description="Departure Stop atco_code. First stop of a Journey."),
            description="Departure Stop atco_code. First stop of a Journey."
        ),
        coreapi.Field(
            "departure_time",
            required=True,
            location="query",
            schema=coreschema.String(description="Departure datetime or time. "
                                                 "The date or time when the Journey starts. "
                                                 "If time is given insetad of a datetime, today is used as date. "
                                                 "The datetime or date must be given in ISO 8601 format."),
            description="Departure datetime or time. The date or time when the Journey starts. "
                        "If time is given insetad of a datetime, today is used as date. "
                        "The datetime or date must be given in ISO 8601 format."
        ),
        coreapi.Field(
            "destination_stop_id",
            required=False,
            location="query",
            schema=coreschema.String(description="Destination Stop atco_code. Last stop of a Journey."),
            description="Destination Stop atco_code. Last stop of a Journey."
        ),
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Exdpands the resulted Journey into a full object"
        ),
    ],
    description="Using a Departure Stop and a Departure time tries to match it with a VehicleJourney. "
                "Returns the list of VehicleJourney that match."
)


@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@schema(departure_to_journey_schema)
def departure_to_journey(request):
    '''Using a Departure Stop and a Departure time tries to match it with a VehicleJourney.
    Returns the list of VehicleJourney that match.
    '''
    try:
        departure_stop_id = request.GET['departure_stop_id']
    except:
        return Response({"details": "departure_stop_id not present"}, status=400)
    try:
        departure_time = parse(request.GET['departure_time'])
    except:
        return Response({"details": "departure_time not present or has wrong format, has to be ISO"}, status=400)
    try:
        departure_stop = Stop.objects.get(atco_code=departure_stop_id)
    except:
        return Response({"details": "Departure Stop %s not found" % departure_stop_id}, status=404)
    destination_stop_id = request.GET.get('destination_stop_id', None)
    if destination_stop_id and not Stop.objects.filter(atco_code=destination_stop_id).exists():
        return Response({"details": "Destination Stop %s not found" % destination_stop_id}, status=404)
    vj_list = calculate_vehicle_journey(departure_time, departure_stop.atco_code, destination_stop_id)
    if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
        vj_list = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=vj_list), many=True).data
    return Response({'results': vj_list})


siriVM_POST_to_journey_schema = AutoSchema(
    manual_fields = [
        coreapi.Field(
            "body",
            required=True,
            location="body",
            type="application/json",
            schema=coreschema.String(description="siriVM data block"),
            description="siriVM data block"
        ),
    ]
)

@csrf_exempt
@api_view(['POST'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@parser_classes((JSONParser,))
@schema(siriVM_POST_to_journey_schema)
def siriVM_POST_to_journey(request):
    '''Reads sirivm_data from POST and adds VehicleJourney data to its entries'''
    try:
        jsondata = json.loads(request.body.decode("utf-8"))
        if jsondata.__class__ == str:
            jsondata = json.loads(jsondata)
    except Exception as e:
        return Response({"details": "JSON wrongly formatted: %s" % e}, status=500)
    if 'request_data' not in jsondata:
        return Response({"details": "missing request_data from json"}, status=400)
    try:
        for bus in jsondata['request_data']:
            bus['vehicle_journeys'] = \
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'],
                                          bus['DestinationRef'])
    except Exception as e:
        return Response({"details": "error while processing siriVM data: %s" % e}, status=500)
    return Response(jsondata)


siriVM_to_journey_schema = ManualSchema(
    fields = [
        coreapi.Field(
            "expand_journey",
            required=False,
            location="query",
            schema=coreschema.Boolean(description="Exdpands the resulted Journey into a full object"),
            description="Expands the resulted Journey into a full object"
        ),
    ],
    description="Reads last data from siriVM feed and tries to match it with a VehicleJourney."
)

@api_view(['GET'])
@renderer_classes((JSONRenderer, BrowsableAPIRenderer))
@schema(siriVM_to_journey_schema)
def siriVM_to_journey(request):
    """Reads last data from siriVM feed and tries to match it with a VehicleJourney

    get:
    returns the last data fro the siriVM feed and adds to each entry the corresponding vehicle_journey entry
    """
    try:
        real_time = json.loads(
            Path('/media/tfc/sirivm_json/data_monitor/' + listdir('/media/tfc/sirivm_json/data_monitor/')[0])
                .read_text())
    except:
        return Response({"details": "error while importing siriVM data json file"}, status=500)

    try:
        for bus in real_time['request_data']:
            bus['vehicle_journeys'] = \
                calculate_vehicle_journey(string_to_datetime(bus['OriginAimedDepartureTime']), bus['OriginRef'],
                                          bus['DestinationRef'])
            if 'expand_journey' in request.GET and request.GET['expand_journey'] == 'true':
                bus['vehicle_journeys'] = VehicleJourneySerializer(VehicleJourney.objects.filter(pk__in=bus['vehicle_journeys']), many=True).data
    except:
        return Response({"details": "error while importing siriVM data json file"}, status=500)
    return Response(real_time)


class VehicleJourneyList(generics.ListAPIView):
    """
    Return a list of all the existing VehicleJourney.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer
    pagination_class = Pagination


class VehicleJourneyRetrieve(generics.RetrieveAPIView):
    """
    Return the VehicleJourney corresponding to the given id.
    """
    queryset = VehicleJourney.objects.all()
    serializer_class = VehicleJourneySerializer


class StopList(generics.ListAPIView):
    """
    Return a list of all the existing Stops.
    """
    serializer_class = StopSerializer
    pagination_class = Pagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    ordering_fields = ('atco_code', 'common_name', 'locality_name')
    ordering = ('atco_code', )
    search_fields = ('atco_code', 'common_name', 'locality_name')

    schema = AutoSchema(
        manual_fields=[
            coreapi.Field(
                "bounding_box",
                required=False,
                location="query",
                schema=coreschema.String(
                    description="Limit results to stops within a bounding "
                                "box, specified as "
                                "'southwest_lng,southwest_lat,northeast_lng,"
                                "northeast_lat' (matching Leaflet's "
                                "toBBoxString() method"
                    ),
                description="Limit results to stops within a bounding "
                            "box, specified as "
                            "'southwest_lng,southwest_lat,northeast_lng,"
                            "northeast_lat' (matching Leaflet's "
                            "toBBoxString() method"
            )
        ]
    )

    def list(self, request, *args, **kwargs):
        # Retrieve the bounding box from the list of GET parameters
        bounding_box = self.request.query_params.get('bounding_box', None)
        if bounding_box is not None:
            match = match = re.match(r'^([^,]+),([^,]+),([^,]+),([^,]+)$',
                                     bounding_box)
            if match:
                try:
                    self.bounding_box = {
                        'west': float(match.group(1)),
                        'south': float(match.group(2)),
                        'east': float(match.group(3)),
                        'north': float(match.group(4))
                    }
                except ValueError:
                    return Response({"details": "bouding_box coordinates not "
                                     "properly formatted"}, status=500)
            else:
                return Response({"details": "bouding_box parameter not "
                                 "properly formatted"}, status=500)
        return super().list(self, request, *args, **kwargs)

    def get_queryset(self):
        try:
            return Stop.objects.filter(
                latitude__range=(self.bounding_box['south'],
                                 self.bounding_box['north']),
                longitude__range=(self.bounding_box['west'],
                                  self.bounding_box['east']))
        except AttributeError:
            return Stop.objects.all()


class StopRetrieve(generics.RetrieveAPIView):
    """
    Return the Stop corresponding to the given id (atco_code).
    """
    queryset = Stop.objects.all()
    serializer_class = StopSerializer
