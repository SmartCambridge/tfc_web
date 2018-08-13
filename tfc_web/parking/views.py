import json
from datetime import date, timedelta, datetime
from urllib.error import HTTPError
from django.shortcuts import render
import logging

from api.util import do_api_call

logger = logging.getLogger(__name__)

#############################################################################
# Utilities                                                                 £
#############################################################################


def get_parking_list():

    data = do_api_call('/api/v1/parking/')
    return {'request_data': data}


def get_parking_metadata(parking_id):

    data = do_api_call('/api/v1/parking/' + parking_id)
    # Fix for change between old and new API field names
    data['capacity'] = data['spaces_capacity']
    return {'request_data': data}


def get_parking_history(parking_id, date):

        return do_api_call(
            '/api/v1/parking/history/' + parking_id +
            '?start_date=' + date)


def get_parking_occupancy(parking_list):

    request_data = []
    for car_park in parking_list['request_data']['parking_list']:
        try:
            data = do_api_call(
                '/api/v1/parking/latest/' +
                car_park['parking_id'])
            request_data.append(data)
        except HTTPError as e:
            if e.code != 404:
                raise e
    return {'request_data': {'request_data': request_data}}

#############################################################################
# parking/plot/<parking_id>?date=YYYY-MM-DD&priordays=n[,n...]              #
#############################################################################


def parking_plot(request, parking_id):

    today = date.today()

    # get ?date=YYYY-MM-DD if it's there, otherwise use today's date
    user_date = request.GET.get('date')
    if not user_date:
        q_date = today
    else:
        try:
            q_date = datetime.strptime(user_date, '%Y-%m-%d').date()
        except ValueError:
            logger.info('Unrecoginsed date %s', user_date)
            q_date = today

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

    parking_json = []

    for days in days_list:
        this_date = (q_date-timedelta(days=days)).strftime('%Y-%m-%d')
        parking_json.append(get_parking_history(parking_id, this_date))

    parking_config = get_parking_metadata(parking_id)

    user_date = q_date.strftime('%Y-%m-%d')
    YYYY = user_date[0:4]
    MM = user_date[5:7]
    DD = user_date[8:10]

    return render(request, 'parking/parking_plot.html', {
        'config_date':  user_date,
        'config_parking_id': parking_id,
        'config_YYYY': YYYY,
        'config_MM':    MM,
        'config_DD':    DD,
        'config_parking_data': json.dumps(parking_json),
        'config_parking_config': json.dumps(parking_config)
    })


#############################################################################
# parking/map                                                               #
#############################################################################

def parking_map(request):

    parking_list = get_parking_list()
    parking_feed = get_parking_occupancy(parking_list)

    return render(request, 'parking/parking_map.html', {
        'config_parking_list': json.dumps(parking_list),
        'config_parking_feed': json.dumps(parking_feed)
    })


#############################################################################
# parking/list                                                              #
#############################################################################

def parking_list(request):
    parking_list = get_parking_list()
    parking_feed = get_parking_occupancy(parking_list)

    return render(request, 'parking/parking_list.html', {
        'config_parking_list': json.dumps(parking_list),
        'config_parking_feed': json.dumps(parking_feed)
    })
