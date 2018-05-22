
from .serializers import AQListSerializer, AQConfigSerializer, \
 AQDataSerializer
from api import util, auth
from datetime import datetime
from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView
import logging


logger = logging.getLogger(__name__)


def get_aq_config(station_id=None):
    if station_id is None:
        return util.get_config('cam_aq')
    else:
        return util.get_config('cam_aq', station_id,
                               'aq_list', 'StationID')


class AQList(auth.AuthenticateddAPIView):
    ''' Return metadata for all stations '''
    def get(self, request):
        data = get_aq_config()
        serializer = AQListSerializer(data)
        return Response(serializer.data)


class AQConfig(auth.AuthenticateddAPIView):
    ''' Return metadata for a single station '''
    def get(self, request, station_id):
        data = get_aq_config(station_id)
        serializer = AQConfigSerializer(data)
        return Response(serializer.data)


class AQHistory(auth.AuthenticateddAPIView):
    ''' Return historic data for a station/sensor/month '''
    def get(self, request, station_id, sensor_type, month):
        # Note that this validates station_id!
        config = get_aq_config(station_id)

        if sensor_type not in config['SensorTypes']:
            raise Http404("No sensor '{0}' on station '{0}'"
                          .format(sensor_type, station_id))

        month = datetime.strptime(month, '%Y-%m')

        try:
            filename = (
                'cam_aq/data_bin/{1:%Y}/{1:%m}/{0}/{0}_{2}_{1:%Y-%m}.json'
                .format(station_id, month, sensor_type)
                )
            results = util.read_json(filename)
        except (FileNotFoundError):
            raise Http404("No data found for station '{0}', sensor '{1}', "
                          "month '{2:%Y-%m}'"
                          .format(station_id, sensor_type, month))

        serializer = AQDataSerializer(results)
        return Response(serializer.data)
