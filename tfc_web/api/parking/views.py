
from .serializers import ParkingListSerializer, ParkingConfigSerializer, \
 ParkingRecordSerializer, ParkingHistorySerializer
from api import util, auth
from datetime import timedelta
from rest_framework.response import Response
import logging
from rest_framework.exceptions import NotFound


logger = logging.getLogger(__name__)


def get_feed_config(feed_id):
    return util.get_config('feed', feed_id, 'feed_list', 'feed_id')


def get_parking_config(parking_id=None):
    if parking_id is None:
        return util.get_config('parking')
    else:
        try:
            return util.get_config('parking', parking_id,
                                   'parking_list', 'parking_id')
        except (util.TFCValidationError) as e:
            raise NotFound("Car park not found: {0}".format(e))


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
    raise NotFound("No data found for '{0}'".format(parking_id))


class ParkingList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known car parks, including each car park's
    _parking-id_
    '''
    def get(self, request):
        data = get_parking_config()
        serializer = ParkingListSerializer(data)
        return Response(serializer.data)


class ParkingConfig(auth.AuthenticateddAPIView):
    '''
    Return the metadata for a single car park identified by _parking_id_
    '''
    def get(self, request, parking_id):
        data = get_parking_config(parking_id)
        serializer = ParkingConfigSerializer(data)
        return Response(serializer.data)


class ParkingHistory(auth.AuthenticateddAPIView):
    '''
    Return historic car park occupancy data for a single car park
    identified by _parking_id_. data is returned in 24-hour chunks from
    _start_date_ to _end_date_ inclusive. A most 31 day's data can be
    retrieved in a single request.
    '''
    schema = util.list_args_schema

    def get(self, request, parking_id):

        args = util.ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        # Note that this validates parking_id!
        config = get_parking_config(parking_id)
        feed_id = config['feed_id']

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


class ParkingLatest(auth.AuthenticateddAPIView):
    '''
    Return most recent car park occupancy data for the car park
    identified by parking_id
    '''

    def get(self, request, parking_id):
        data = get_parking_monitor(parking_id)
        serializer = ParkingRecordSerializer(data)
        return Response(serializer.data)


class ParkingPrevious(auth.AuthenticateddAPIView):
    '''
    Return previous most recent car park occupancy data for the car park
    identified by parking_id
    '''

    def get(self, request, parking_id):
        data = get_parking_monitor(parking_id, '.prev')
        serializer = ParkingRecordSerializer(data)
        return Response(serializer.data)
