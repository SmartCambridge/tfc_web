import json
from django.shortcuts import render
from django.http import Http404
from datetime import date, timedelta, datetime
from urllib.error import HTTPError
import logging

from api.util import do_api_call

logger = logging.getLogger(__name__)

#############################################################################
# Utilities                                                                 £
#############################################################################


def get_aq_list():

    data = do_api_call('/api/v1/aq/')
    return {'request_data': data}


def get_aq_metadata(station_id):

    data = do_api_call('/api/v1/aq/' + station_id)
    return {'request_data': data}


def get_aq_history(station_id, sensor_type, month):

        data = do_api_call(
            '/api/v1/aq/history/' + station_id + '/' + sensor_type + '/' + month)
        return {'request_data': data}

#############################################################################
# AQ PLOT                                                                   #
# aq/plot/<StationID>?[sensor_type=CO][&date=YYYY-MM-DD]                    #
#############################################################################

def aq_plot(request, station_id):

    today = date.today()

    # get data
    user_date = request.GET.get('date')
    if not user_date:
        q_date = today
    else:
        q_date = datetime.strptime(user_date, '%Y-%m-%d').date()

    # get sensor type
    sensor_type = request.GET.get('sensor_type', 'CO')

    # get ?prior_days=7,14 if it's there to provide 'shadow' plot on chart
    days_list = [0]
    try:
        prior_days = request.GET.get('priordays')
        if prior_days:
            for d in prior_days.split(','):
                days_list.append(int(d))
    except ValueError:
        logger.info('Unrecognised priordays %s', prior_days)
        days_list = [0]

    sensor_json = []

    for days in days_list:
        this_date = (q_date-timedelta(days=days)).strftime('%Y-%m')
        try:
            sensor_json.append(
                get_aq_history(station_id, sensor_type, this_date)
            )
        except HTTPError as e:
            if e.code != 404:
                raise e

    try:
        station_config = get_aq_metadata(station_id)
    except HTTPError as e:
        if e.code == 404:
            raise Http404("AQ Plot invalid station id {0}".format(station_id))
        else:
            raise e

    user_date = q_date.strftime('%Y-%m-%d')
    YYYY = user_date[0:4]
    MM = user_date[5:7]
    DD = user_date[8:10]

    return render(request, 'aq/aq_plot.html', {
        'config_date':  user_date,
        'config_station_id': station_id,
        'config_sensor_type': sensor_type,
        'config_YYYY':  YYYY,
        'config_MM':    MM,
        'config_DD':    DD,
        'config_sensor_data': json.dumps(sensor_json),
        'config_station_config': json.dumps(station_config)
    })


#############################################################################
# AQ MAP                                                                    #
#############################################################################

def aq_map(request):

    aq_list = get_aq_list()

    return render(request, 'aq/aq_map.html', {
        'config_aq_list': json.dumps(aq_list)

    })


#############################################################################
# aq/list                                                                   #
#############################################################################

def aq_list(request):

    aq_list = get_aq_list()

    return render(request, 'aq/aq_list.html', {
        'config_aq_list': json.dumps(aq_list)

    })
