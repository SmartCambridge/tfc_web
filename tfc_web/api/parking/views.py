
from .serializers import ParkingListSerializer, ParkingConfigSerializer, \
 ParkingRecordSerializer, ParkingHistorySerializer, ListArgsSerializer
from api import util
from datetime import timedelta
from django.http import Http404
from rest_framework.response import Response
from rest_framework.schemas import AutoSchema
from rest_framework.views import APIView
import coreapi
import coreschema
import logging


# Path to the config data for parking
MAX_DAYS = 31

logger = logging.getLogger(__name__)


def get_feed_config(feed_id):
    return util.get_config('feed', feed_id, 'feed_list', 'feed_id')


def get_parking_config(parking_id=None):
    if parking_id is None:
        return util.get_config('parking')
    else:
        return util.get_config('parking', parking_id,
                               'parking_list', 'parking_id')


def get_parking_monitor(parking_id, suffix=''):
    '''
    Get recent or previous-recent data for a particular car park
    '''
    config = get_parking_config(parking_id)
    feed_id = config['feed_id']
    # Read latest data
    filename = ('{0}/data_monitor_json/post_data.json{1}'
                .format(feed_id, suffix))
    data = util.read_json(filename)
    # Find this car park
    for value in data['request_data']:
        if value['parking_id'] == parking_id:
            # Populate car park record with feed_id & ts from envelope
            value['feed_id'] = data['feed_id']
            value['ts'] = data['ts']
            value['acp_ts'] = value['ts']
            return value
    raise Http404('No data found for "{0}"'.format(parking_id))


class ParkingList(APIView):
    '''
    List metadata for all known car parks, including each car park's
    _parking-id_
    '''
    def get(self, request):
        data = get_parking_config()
        serializer = ParkingListSerializer(data)
        return Response(serializer.data)


class ParkingConfig(APIView):
    '''
    Return the metadata for a single car park identified by _parking_id_
    '''
    def get(self, request, parking_id):
        data = get_parking_config(parking_id)
        serializer = ParkingConfigSerializer(data)
        return Response(serializer.data)


parking_history_extra_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "start_date",
            required=True,
            location="query",
            schema=coreschema.String(
                description="Start date for returned data (YYYY-MM-DD)")
        ),
        coreapi.Field(
            "end_date",
            location="query",
            schema=coreschema.String(
                description="End date for returned data (YYYY-MM-DD). "
                "Defaults to start_date and must be no more than 31 days "
                "from start_date")
        ),
        coreapi.Field(
            "feed_id",
            location="query",
            schema=coreschema.String(
                description="ID of the internal feed from which data "
                "should be retrieved. Default is to use the default "
                "feed for parking_id.")
        )
    ]
)


class ParkingHistory(APIView):
    '''
    Return historic car park occupancy data for a single car park
    identified by _parking_id_. data is returned in 24-hour chunks from
    _start_date_ to _end_date_ inclusive. A most 31 day's data can be
    retrieved in a single request.
    '''
    schema = parking_history_extra_schema

    def get(self, request, parking_id):

        args = ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        # Note that this validates parking_id!
        config = get_parking_config(parking_id)

        feed_id = args.validated_data.get('feed_id')
        if feed_id is None:
            feed_id = config['feed_id']
        # Note that this validates feed_id!
        get_feed_config(feed_id)

        start_date = args.validated_data.get('start_date')
        end_date = args.validated_data.get('end_date')
        if end_date is None:
            end_date = start_date
        day_count = (end_date - start_date).days + 1

        results = []
        for date in (start_date + timedelta(n) for n in range(day_count)):
            try:
                filename = (
                    '{0}/data_park/{2:%Y}/{2:%m}/{2:%d}/{1}_{2:%Y-%m-%d}.txt'
                    .format(feed_id, parking_id, date)
                    )
                results = results + util.read_json_fragments(filename)
            except (FileNotFoundError):
                pass
        serializer = ParkingHistorySerializer({'request_data': results})
        return Response(serializer.data)


class ParkingLatest(APIView):
    '''
    Return most recent car park occupancy data for the car park
    identified by parking_id
    '''
    def get(self, request, parking_id):
        data = get_parking_monitor(parking_id)
        serializer = ParkingRecordSerializer(data)
        return Response(serializer.data)


class ParkingPrevious(APIView):
    '''
    Return previous most recent car park occupancy data for the car park
    identified by parking_id
    '''
    def get(self, request, parking_id):
        data = get_parking_monitor(parking_id, '.prev')
        serializer = ParkingRecordSerializer(data)
        return Response(serializer.data)
