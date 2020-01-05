from datetime import timedelta
import logging

from rest_framework import generics, filters
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from rest_framework.schemas import AutoSchema

from api.api_docs import transport_stops_pagination_fields
from api.auth import default_authentication, default_permission, default_throttle
from transport.api.views import Pagination, string_to_datetime
from .serializers import (
    ZoneListSerializer, ZoneConfigSerializer, ZoneHistorySerializer, ANPRCameraSerializer, ANPRTripSerializer)
from api import util, auth, api_docs

import coreapi
import coreschema

from ..models import ANPRCamera, Trip

logger = logging.getLogger(__name__)


def get_zone_config(zone_id=None):
    if zone_id is None:
        return util.get_config('zone')
    else:
        try:
            return util.get_config('zone', zone_id,
                                   'zone_list', 'zone.id')
        except (util.TFCValidationError) as e:
            raise NotFound("Zone not found: {0}".format(e))


def swap_dot_and_underscore(data):
    ''' serializer can't cope with '.' in keys - switch to '_' '''
    return {key.replace('.', '_'): value for (key, value) in data.items()}


class ZoneList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known zones, including each zone's
    _zone_id_.
    '''
    def get(self, request):
        data = get_zone_config()
        # serializer can't cope with '.' in keys - switch to '_'
        fixed_zones = []
        for zone in data['zone_list']:
            fixed_zone = swap_dot_and_underscore(zone)
            fixed_zones.append(fixed_zone)
        serializer = ZoneListSerializer({"zone_list": fixed_zones})
        return Response(serializer.data)


class ZoneConfig(auth.AuthenticateddAPIView):
    '''
    Return the metadata for a single zone identified by _zone_id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.zone_id_fields)

    def get(self, request, zone_id):
        data = get_zone_config(zone_id)
        serializer = ZoneConfigSerializer(swap_dot_and_underscore(data))
        return Response(serializer.data)


class ZoneHistory(auth.AuthenticateddAPIView):
    '''
    Return historic zone data for the single zone identified by _zone_id_.
    Data is returned in 24-hour chunks from _start_date_ to _end_date_
    inclusive. A most 31 day's data can be retrieved in a single request.
    '''
    schema = AutoSchema(manual_fields=api_docs.zone_id_fields+api_docs.list_args_fields)

    def get(self, request, zone_id):

        args = util.ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        # Note that this validates zone_id!
        get_zone_config(zone_id)

        start_date = args.validated_data.get('start_date')
        end_date = args.validated_data.get('end_date')
        if end_date is None:
            end_date = start_date
        day_count = (end_date - start_date).days + 1

        results = []
        for date in (start_date + timedelta(n) for n in range(day_count)):
            try:
                filename = (
                    'cloudamber/sirivm/data_zone/'
                    '{1:%Y}/{1:%m}/{1:%d}/{0}_{1:%Y-%m-%d}.txt'
                    .format(zone_id, date)
                    )
                results = results + util.read_json_fragments(filename)
            except (FileNotFoundError):
                pass
        serializer = ZoneHistorySerializer({'request_data': results})
        return Response(serializer.data)


class ANPRCameraList(generics.ListAPIView):
    """
    Return a list of bus stops.
    """
    queryset = ANPRCamera.objects.all()
    serializer_class = ANPRCameraSerializer

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle


ANPRTripList_schema = AutoSchema(
    manual_fields=transport_stops_pagination_fields + [
        coreapi.Field(
            "datetime_from",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Start datetime for returned results."),
            description="Start datetime for returned results.",
            example="2017-06-12T12:00:00",
        ),
        coreapi.Field(
            "datetime_to",
            required=False,
            location="query",
            schema=coreschema.String(
                description="End datetime for returned results."),
            description="End datetime for returned results.",
            example="2017-06-12T12:00:00",
        ),
        coreapi.Field(
            "entry_camera_id",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to trips that have this as the entry camera."
                ),
            description="Limit results to trips that have this as the entry camera."
        ),
        coreapi.Field(
            "exit_camera_id",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Limit results to trips that have this as the exit camera."
                ),
            description="Limit results to trips that have this as the exit camera."
        ),
        coreapi.Field(
            "ordering",
            required=False,
            location="query",
            schema=coreschema.String(
                description="Field to sort results by. One of "
                            "'entry_time', 'entry_camera_id', 'exit_camera_id'."
                ),
            description="Field to sort results by. One of "
                        "'entry_time', 'entry_camera_id', 'exit_camera_id'."
        ),
    ]
)


class ANPRTripList(generics.ListAPIView):
    """
    ANPR based trips
    """
    serializer_class = ANPRTripSerializer
    pagination_class = Pagination
    filter_backends = (filters.SearchFilter, filters.OrderingFilter)
    ordering_fields = ('entry_time', 'entry_camera_id', 'exit_camera_id')
    ordering = ('entry_time', )
    search_fields = ('entry_camera_id', 'exit_camera_id')

    schema = ANPRTripList_schema

    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle

    def list(self, request, *args, **kwargs):
        self.datetime_from = string_to_datetime(self.request.query_params.get('datetime_from', None))
        self.datetime_to = string_to_datetime(self.request.query_params.get('datetime_to', None))
        self.entry_camera_id = self.request.query_params.get('entry_camera_id', None)
        self.exit_camera_id = self.request.query_params.get('exit_camera_id', None)
        return super().list(self, request, *args, **kwargs)

    def get_queryset(self):
        query = Trip.objects.all()
        try:
            if self.datetime_from:
                query = query.filter(entry_time__gte=self.datetime_from)
            if self.datetime_to:
                query = query.filter(entry_time__lte=self.datetime_to)
            if self.entry_camera_id:
                query = query.filter(entry_camera_id=self.entry_camera_id)
            if self.exit_camera_id:
                query = query.filter(exit_camera_id=self.exit_camera_id)
        except AttributeError:
            pass
        return query
