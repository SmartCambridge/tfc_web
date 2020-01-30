import json
import re
import time
from datetime import date, datetime, timedelta

from django.core.serializers.json import DjangoJSONEncoder
from django.shortcuts import render
from django.urls import reverse
from django.http import Http404, JsonResponse
from urllib.error import HTTPError
import logging

from api.util import do_api_call
from traffic.models import ANPRCamera, TripChain


logger = logging.getLogger(__name__)


def anpr_map(request, return_format='html'):
    start_time = request.GET.get('datetime', time.mktime(datetime(day=11, month=6, year=2017, hour=8).timetuple()))
    start_time = datetime.fromtimestamp(int(start_time))
    # Discard all trips that took longer than 3 hours as these are very likely round trips.
    trips_m = TripChain.objects.filter(entry_time__range=(start_time, start_time + timedelta(hours=1)),
                                       total_trip_time__lt=timedelta(hours=3))
    trips = []
    for trip_m in trips_m:
        trips.append({
            "time": trip_m.entry_time,
            "chain_vector": re.split(r'_[A-Za-z]+>?', trip_m.chain_vector)[0:-1]
        })
    if return_format == 'html':
        return render(request, 'traffic/anpr_camera.html', {
            'cameras': ANPRCamera.objects.all(),
            'trips': json.dumps(trips, cls=DjangoJSONEncoder)
        })
    elif return_format == 'json':
        return JsonResponse({
            'trips': trips
        })
    else:
        raise Exception('Format not supported')


#############################################################################
# Utilities                                                                 £
#############################################################################


def get_zone_list():

    data = do_api_call('/api/v1/traffic/zone/')
    return {'request_data': data}


def get_zone_metadata(zone_id):

    data = do_api_call('/api/v1/traffic/zone/' + zone_id)
    return {'request_data': {'options': {'config': data}}}


def get_zone_history(zone_id, date):

        return do_api_call(
            '/api/v1/traffic/zone/history/' + zone_id +
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

    try:
        transit_json = get_zone_history(zone_id, user_date)
        zone_config = get_zone_metadata(zone_id)
    except HTTPError as e:
        if e.code == 404:
            raise Http404("Zone transit plot invalid zone id {0}".format(zone_id))
        else:
            raise e

    zone_reverse_id = zone_config['request_data']['options']['config'].get('zone_reverse_id',None)

    return render(request, 'traffic/zone_transit_plot.html', {
        'config_date':  user_date,
        'config_zone_id': zone_id,
        'config_yyyy':  yyyy,
        'config_MM':    MM,
        'config_dd':    dd,
        'config_zone_id': zone_id,
        'config_zone_reverse_id': zone_reverse_id,
        'config_zone_data': json.dumps(transit_json),
        'config_zone_config': json.dumps(zone_config)
    })


#############################################################################
# traffic/zones/map                                                         #
#############################################################################

def zones_map(request):

    zone_list = get_zone_list()

    for zone in zone_list['request_data']['zone_list']:
        zone['map_url'] = reverse('zone_map', args=[zone['zone_id']])
        zone['transit_plot_url'] = reverse('zone_transit_plot', args=[zone['zone_id']])
        if 'zone_reverse_id' in zone:
            zone['reverse_map_url'] = reverse('zone_map', args=[zone['zone_reverse_id']])
            zone['reverse_transit_plot_url'] = reverse('zone_transit_plot', args=[zone['zone_reverse_id']])

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
