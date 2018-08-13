import json
from datetime import date
from django.shortcuts import render
import logging

from api.util import do_api_call

logger = logging.getLogger(__name__)

#############################################################################
# Utilities                                                                 £
#############################################################################


def get_zone_list():

    data = do_api_call('/api/v1/zone/')
    return {'request_data': data}


def get_zone_metadata(zone_id):

    data = do_api_call('/api/v1/zone/' + zone_id)
    return {'request_data': {'options': {'config': data}}}


def get_zone_history(zone_id, date):

        return do_api_call(
            '/api/v1/zone/history/' + zone_id +
            '?start_date=' + date)


#############################################################################
# traffic/zone/transit_plot/<zone_id>?date=YYYY-MM-DD                       #
#############################################################################

def zone_transit_plot(request, zone_id):

    today = date.today().strftime('%Y-%m-%d')

    user_date = request.GET.get('date')
    if not user_date:
        user_date = today

    yyyy = user_date[0:4]
    MM = user_date[5:7]
    dd = user_date[8:10]

    transit_json = get_zone_history(zone_id, user_date)
    zone_config = get_zone_metadata(zone_id)

    return render(request, 'traffic/zone_transit_plot.html', {
        'config_date':  user_date,
        'config_zone_id': zone_id,
        'config_yyyy':  yyyy,
        'config_MM':    MM,
        'config_dd':    dd,
        'config_zone_id': zone_id,
        'config_zone_data': json.dumps(transit_json),
        'config_zone_config': json.dumps(zone_config)
    })


#############################################################################
# traffic/zones/map                                                         #
#############################################################################

def zones_map(request):

    zone_list = get_zone_list()

    return render(request, 'traffic/zones_map.html', {
        'config_zone_list': json.dumps(zone_list),
    })


#############################################################################
# traffic/zones/map                                                         #
#############################################################################

def zones_list(request):

    zone_list = get_zone_list()

    return render(request, 'traffic/zones_list.html', {
        'config_zone_list': zone_list,
    })


#############################################################################
# traffic/zone/map/<zone_id>                                                #
#############################################################################

def zone_map(request, zone_id):

    zone_config = get_zone_metadata(zone_id)

    return render(request, 'traffic/zone_map.html', {
        'config_zone_id': zone_id,
        'config_zone_config': json.dumps(zone_config)
    })
