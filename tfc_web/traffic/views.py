import json
import re
import time
from datetime import date, datetime, timedelta

from django.conf import settings
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

    camera_origin_id = request.GET.get('camera_origin_id')
    camera_destination_id = request.GET.get('camera_destination_id')

    # Discard all trips that took longer than 3 hours as these are very likely round trips.
    trips_m = TripChain.objects.filter(entry_time__range=(start_time, start_time + timedelta(hours=1)),
                                       total_trip_time__lt=timedelta(hours=3))

    if camera_origin_id and camera_destination_id:
        trips_m = trips_m.filter(
            chain_vector__regex=r'^([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_origin_id +
                                '(_[A-Za-z]+)?>?([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_destination_id +
                                '(_[A-Za-z]+)?(>[A-Za-z0-9]+(_[A-Za-z]+)?)*$')
    elif camera_origin_id:
        trips_m = trips_m.filter(chain_vector__regex=r'^([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_origin_id +
                                                     '(_[A-Za-z]+)?(>[A-Za-z0-9]+(_[A-Za-z]+)?)*$')

    trips = []
    for trip_m in trips_m:
        trips.append({
            "time": trip_m.entry_time,
            "chain_vector": re.split(r'_[A-Za-z]+>?', trip_m.chain_vector)[0:-1]
        })

    #calculate stats
    day = start_time.date()
    start_time_stats = datetime.combine(day, datetime.min.time())
    stats = []
    total_stats = []
    for i in range(0,24):
        # Discard all trips that took longer than 3 hours as these are very likely round trips.
        trips_m = TripChain.objects.filter(entry_time__range=(start_time_stats, start_time_stats + timedelta(hours=1)))
        total_stats.append({
            "time": start_time_stats,
            "num": trips_m.count()
        })
        if camera_origin_id and camera_destination_id:
            trips_m = trips_m.filter(
                chain_vector__regex=r'^([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_origin_id +
                                    '(_[A-Za-z]+)?>?([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_destination_id +
                                    '(_[A-Za-z]+)?(>[A-Za-z0-9]+(_[A-Za-z]+)?)*$')
        elif camera_origin_id:
            trips_m = trips_m.filter(chain_vector__regex=r'^([A-Za-z0-9]+(_[A-Za-z]+)?>)*' + camera_origin_id +
                                                         '(_[A-Za-z]+)?(>[A-Za-z0-9]+(_[A-Za-z]+)?)*$')
        if camera_origin_id:
            stats.append({
                "time": start_time_stats,
                "num": trips_m.count()
            })
        start_time_stats += timedelta(hours=1)

    if return_format == 'html':
        return render(request, 'traffic/anpr_camera.html', {
            'cameras': ANPRCamera.objects.all(),
            'trips': json.dumps(trips, cls=DjangoJSONEncoder),
            'stats': json.dumps(stats, cls=DjangoJSONEncoder),
            'total_stats': json.dumps(total_stats, cls=DjangoJSONEncoder)
        })
    elif return_format == 'json':
        return JsonResponse({
            'trips': trips,
            'stats': stats,
            'total_stats': total_stats
        })
    else:
        raise Exception('Format not supported')


#############################################################################
# Zone utilities                                                                 £
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


#############################################################################
# BT Journey utilities                                                                 £
#############################################################################



def get_link_list():

    return do_api_call('/api/v1/traffic/btjourney/link/')


def get_route_list():

    return do_api_call('/api/v1/traffic/btjourney/route/')


def get_btjourney_link_or_route(link_id):

    return do_api_call('/api/v1/traffic/btjourney/link_or_route/' + link_id)


def get_btjourney_history(link_id, date):

        return do_api_call(
            '/api/v1/traffic/btjourney/history/' + link_id +
            '?start_date=' + date)


def add_sortable_names(link_list):
    '''
    Make a 'sortable' version of a a link (or route) name by moving
    any numeric+optional alpha prefix to the end. This relies on
    heuristics that might break in the future to recognise the prefix.
    '''

    for link in link_list:
        link['sortname'] = re.sub(r'^(\d+\w*):? *(.*)$', r'\2 (\1)', link['name'])


#############################################################################
# traffic/btjourney/plot/<link_id>?date=YYYY-MM-DD                          #
#############################################################################

def btjourney_plot(request, link_id):

    today = date.today().strftime('%Y-%m-%d')

    user_date = request.GET.get('date')
    if not user_date:
        user_date = today

    yyyy = user_date[0:4]
    MM = user_date[5:7]
    dd = user_date[8:10]

    try:
        journey_json = get_btjourney_history(link_id, user_date)
        link_config = get_btjourney_link_or_route(link_id)
    except HTTPError as e:
        if e.code == 404:
            raise Http404("btjourney plot invalid link id {0}".format(link_id))
        else:
            raise e

    return render(request, 'traffic/btjourney_plot.html', {
        'config_date':  user_date,
        'config_link_id': link_id,
        'config_yyyy':  yyyy,
        'config_MM':    MM,
        'config_dd':    dd,
        'config_journey_data': json.dumps(journey_json),
        'config_link_config': json.dumps(link_config)
    })


#############################################################################
# traffic/btjourney/map                                                     #
#############################################################################

def btjourney_map(request):

    return render(request, 'traffic/btjourney_map.html', {
        'key': settings.JS_API_KEY,
    })


#############################################################################
# traffic/btjourney/list/                                                   #
#############################################################################

def btjourney_list(request):

    links = get_link_list()['link_list']
    add_sortable_names(links)
    routes = get_route_list()['route_list']
    add_sortable_names(routes)

    sorted_links = sorted(links, key=lambda l: l['sortname'])
    sorted_routes = sorted(routes, key=lambda l: l['sortname'])

    return render(request, 'traffic/btjourney_list.html', {
        'config_links': sorted_links,
        'config_routes': sorted_routes,
    })
