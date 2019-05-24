
from .serializers import (
    AppListSerializer, AppConfigSerializer)
from api import util, auth, api_docs
from datetime import timedelta
from pathlib import Path
from rest_framework.response import Response
from rest_framework.schemas import AutoSchema
import logging
from rest_framework.exceptions import NotFound

logger = logging.getLogger(__name__)

FILES_ROOT = 'csn_ttn' # Cambridge Sensor Network data root
FILES_BIN_PATH = 'data_bin_json' # sub-dir for data files /app-name/YYYY/MM/DD
FILES_MONITOR_PATH = 'data_monitor_json' # sub-dir for data 'monitor' files, i.e. latest

def get_app_list():
    '''
    Return all available application_ids
    '''
    path = Path(FILES_ROOT, FILES_BIN_PATH)
    return util.get_dir_items(path, is_dir=True)


def get_dev_list(app_id):
    '''
    Return all device_ids associated with _app_id_
    '''
    app_ids = get_app_list()
    if app_id not in app_ids:
        raise NotFound("No application '{0}'".format(app_id))
    path = Path(FILES_ROOT, FILES_BIN_PATH, app_id, 'devices')
    return util.get_dir_items(path, suffix='.json')


def get_app_monitor(app_id, dev_eui, suffix=''):
    '''
    Get recent or previous-recent data for _app_id_, optionally limited
    to _dev_id_
    '''

    # Validate dev_eui (and app_id in the process)
    dev_euis = get_dev_list(app_id)
    if dev_eui not in dev_euis:
        raise NotFound("No device '{0}' in application '{1}'".format(dev_eui, app_id))

    path = Path(FILES_ROOT, FILES_MONITOR_PATH, app_id, dev_eui + '.json' + suffix)
    try:
        return util.read_json(path)
    except FileNotFoundError:
        raise NotFound(
            "No recent data for device '{0}' in application '{1}'".format(dev_eui, app_id)
        )


class AppList(auth.AuthenticateddAPIView):
    '''
    List metadata for all known applications, in particular each application's
    TTN application id _app_id_.
    '''
    def get(self, request):
        app_ids = get_app_list()
        app_list = []
        for app_id in app_ids:
            app_list.append({'app_id': app_id})
        data = {'app_list': app_list}
        logger.debug({'data': data})
        serializer = AppListSerializer(data)
        return Response(serializer.data)


class AppConfig(auth.AuthenticateddAPIView):
    '''
    List all devices associated with the application identified by _app_id_,
    in particular each device's hardware address _dev_eui_.
    '''
    schema = AutoSchema(manual_fields=api_docs.app_id_fields)

    def get(self, request, app_id):
        dev_euis = get_dev_list(app_id)
        dev_list = []
        for dev_eui in dev_euis:
            dev_list.append({'dev_eui': dev_eui})
        data = {'app_id': app_id, 'dev_list': dev_list}
        serializer = AppConfigSerializer(data)
        return Response(serializer.data)


class AppHistory(auth.AuthenticateddAPIView):
    '''
    Return historic CSN data for a single application identified by
    _app_id_, optionally limited to data from device with hardware address
    _dev_eui_. Data is returned in 24-hour chunks from _start_date_ to
    _end_date_ inclusive. A most 31 day's data can be retrieved in a
    single request. The information returned consists of the raw data
    packets sent by TTN.

    **Note** _This endpoint can return large amounts of data that can
    significantly slow browsers that attempt to display all of it._
    '''
    schema = AutoSchema(manual_fields=(
        api_docs.app_id_fields +
        api_docs.dev_eui_query_fields +
        api_docs.list_args_fields)
    )

    def get(self, request, app_id):

        args = util.ListArgsSerializer(data=request.query_params)
        args.is_valid(raise_exception=True)

        # Get/validate dev_eui (also validates app_id)
        dev_eui = args.validated_data.get('dev_eui')
        if dev_eui:
            dev_euis = get_dev_list(app_id)
            if dev_eui not in dev_euis:
                raise NotFound("No device '{0}' in application '{1}'".format(dev_eui, app_id))
        else:
            app_ids = get_app_list()
            if app_id not in app_ids:
                raise NotFound("No application '{0}'".format(app_id))

        # Get dates
        start_date = args.validated_data.get('start_date')
        end_date = args.validated_data.get('end_date')
        if end_date is None:
            end_date = start_date
        day_count = (end_date - start_date).days + 1

        results = []
        for date in (start_date + timedelta(n) for n in range(day_count)):

            path = Path(FILES_ROOT, FILES_BIN_PATH, app_id,
                        date.strftime('%Y'),
                        date.strftime('%m'),
                        date.strftime('%d'))
            try:
                for dev in util.get_dir_items(path, suffix='.txt'):
                    if dev_eui and dev_eui != dev:
                        continue
                    results = results + util.read_json_fragments(path / (dev + '.txt'))
            except FileNotFoundError:
                pass
        return Response({'app_id': app_id, 'request_data': results})


class AppLatest(auth.AuthenticateddAPIView):
    '''
    Return the most recent TTN data packet data for the device _dev_eui_
    in application _app_id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.app_id_fields + api_docs.dev_eui_path_fields)

    def get(self, request, app_id, dev_eui):
        data = get_app_monitor(app_id, dev_eui)
        return Response(data)


class AppPrevious(auth.AuthenticateddAPIView):
    '''
    Return the previous most recent TTN data packet data for the device _dev_eui_
    in application _app_id_.
    '''
    schema = AutoSchema(manual_fields=api_docs.app_id_fields + api_docs.dev_eui_path_fields)

    def get(self, request, app_id, dev_eui):
        data = get_app_monitor(app_id, dev_eui, '.prev')
        return Response(data)
