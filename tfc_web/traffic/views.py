import codecs
import json
from datetime import date
from urllib.request import urlopen
from django.conf import settings
from django.shortcuts import render


#############################################################################
########   traffic/zone/transit_plot/<zone_id>?date=YYYY-MM-DD  #############
#############################################################################

def zone_transit_plot(request, zone_id):

    today = date.today().strftime('%Y-%m-%d')

    user_date = request.GET.get('date')
    if not user_date:
        user_date = today

    yyyy = user_date[0:4]
    MM = user_date[5:7]
    dd = user_date[8:10]

    feed_id = request.GET.get('feed_id')
    if not feed_id:
        feed_id = 'cloudamber/sirivm'

    reader = codecs.getreader("utf-8")
    try:
        transit_json = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/zone/transits/'+zone_id+'?date='+yyyy+'-'+MM+'-'+dd+'&feed_id='+feed_id
        )))
    except:
        transit_json = None

    try:
        zone_config = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/zone/config/'+zone_id
        )))
    except:
        zone_config = None

    return render(request, 'traffic/zone_transit_plot.html', {
        'config_date':  user_date,
        'config_zone_id': zone_id,
        'config_yyyy' : yyyy,
        'config_MM':    MM,
        'config_dd':    dd,
        'config_feed_id': feed_id,
        'config_zone_id': zone_id,
        'config_zone_data': json.dumps(transit_json),
        'config_zone_config': json.dumps(zone_config)
    })


#############################################################################
########   traffic/zones/map                          #######################
#############################################################################

def zones_map(request):

    reader = codecs.getreader("utf-8")
    try:
        zone_list = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/zone/list'
        )))
    except:
        zone_list = None

    return render(request, 'traffic/zones_map.html', {
        'config_zone_list': json.dumps(zone_list),
    })


#############################################################################
########   traffic/zone/map/<zone_id>                 #######################
#############################################################################

def zone_map(request, zone_id):

    reader = codecs.getreader("utf-8")
    try:
        zone_config = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/zone/config/'+zone_id
        )))
    except:
        zone_config = None

    return render(request, 'traffic/zone_map.html', {
        'config_zone_id': zone_id,
        'config_zone_config': json.dumps(zone_config)
    })
