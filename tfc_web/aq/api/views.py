from .serializers import (
    AQListSerializer, AQConfigSerializer,
    AQDataSerializer)
from api import util, auth
from datetime import datetime
from rest_framework.response import Response
from rest_framework.schemas import AutoSchema
import logging
from rest_framework.exceptions import NotFound
import coreapi
import coreschema


logger = logging.getLogger(__name__)


def get_aq_config(station_id=None):
    if station_id is None:
        return util.get_config('cam_aq')
    else:
        try:
            return util.get_config('cam_aq', station_id,
                                   'aq_list', 'StationID')
        except util.TFCValidationError as e:
            raise NotFound("Station not found: {0}".format(e))


class AQList(auth.AuthenticateddAPIView):
    ''' Return metadata for all stations '''
    def get(self, request):
        data = get_aq_config()
        serializer = AQListSerializer(data)
        return Response(serializer.data)


AQConfig_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "station_id",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Air quality sensor station id (e.g. 'S-1134')"),
            description="Air quality sensor station id (e.g. 'S-1134')"
        ),
    ]
)


class AQConfig(auth.AuthenticateddAPIView):
    ''' Return metadata for a single station '''
    schema = AQConfig_schema

    def get(self, request, station_id):
        data = get_aq_config(station_id)
        serializer = AQConfigSerializer(data)
        return Response(serializer.data)

AQHistory_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "station_id",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Air quality sensor station id (e.g. 'S-1134')"),
            description="Air quality sensor station id (e.g. 'S-1134')"
        ),
        coreapi.Field(
            "sensor_type",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Which sensor on the station to query (e.g. 'NO2')"),
            description="Which sensor on the station to query (e.g. 'NO2')"
        ),
        coreapi.Field(
            "month",
            required=True,
            location="path",
            schema=coreschema.String(
                description="Which month to return data for YYYY-MM (e.g. '2016-06')"),
            description="Which month to return data for YYYY-MM (e.g. '2016-06')"
        ),
    ]
)

class AQHistory(auth.AuthenticateddAPIView):
    ''' Return historic data for a station/sensor/month '''
    schema = AQHistory_schema

    def get(self, request, station_id, sensor_type, month):
        # Note that this validates station_id!
        config = get_aq_config(station_id)

        if sensor_type not in config['SensorTypes']:
            raise NotFound("No sensor '{0}' on station '{1}'"
                           .format(sensor_type, station_id))

        try:
            month = datetime.strptime(month, '%Y-%m')
        except ValueError:
            raise util.TFCValidationError(
                "Month '{0}' has the wrong format. Use YYYY-MM".format(month))

        try:
            filename = (
                'cam_aq/data_bin/{1:%Y}/{1:%m}/{0}/{0}_{2}_{1:%Y-%m}.json'
                .format(station_id, month, sensor_type)
                )
            results = util.read_json(filename)
        except FileNotFoundError:
            raise NotFound("No data found for station '{0}', sensor '{1}', "
                           "month '{2:%Y-%m}'"
                           .format(station_id, sensor_type, month))

        serializer = AQDataSerializer(results)
        return Response(serializer.data)
