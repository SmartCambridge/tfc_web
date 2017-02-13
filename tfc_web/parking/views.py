import codecs
import json
from datetime import date, timedelta, datetime
from urllib.request import urlopen
from django.conf import settings
from django.shortcuts import render


#############################################################################
########   parking/plot/<parking_id>?date=YYYY-MM-DD  #######################
#############################################################################

def parking_plot(request, parking_id):

    today = date.today()

    # get ?date=YYYY-MM-DD if it's there, otherwise use today's date    
    user_date = request.GET.get('date')
    if not user_date:
        q_date = today
    else:
        q_date = datetime.strptime(user_date, '%Y-%m-%d').date()

    # get ?prior_days=7,14 if it's there to provide 'shadow' plot on chart
    days_list = [0]

    try:
        prior_days = request.GET.get('priordays')
        if prior_days:
            for d in prior_days.split(','):
                days_list.append(int(d))
    except:
        days_list = [0]
        
    reader = codecs.getreader("utf-8")

    parking_json = []

    for days in days_list:
        try:
            this_date = (q_date-timedelta(days=days)).strftime('%Y-%m-%d')
            this_YYYY = this_date[0:4]
            this_MM   = this_date[5:7]
            this_DD   = this_date[8:10]

            parking_json.append( json.load(reader(urlopen(
                settings.API_ENDPOINT+'/api/dataserver/parking/occupancy/'+parking_id+'?date='+this_YYYY+'-'+this_MM+'-'+this_DD
            ))))
        except:
            pass

    try:
        parking_config = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/parking/config/'+parking_id
        )))
    except:
        parking_config = None

    user_date = q_date.strftime('%Y-%m-%d')
    YYYY = user_date[0:4]
    MM   = user_date[5:7]
    DD   = user_date[8:10]

    return render(request, 'parking/parking_plot.html', {
        'config_date':  user_date,
        'config_parking_id': parking_id,
        'config_YYYY' : YYYY,
        'config_MM':    MM,
        'config_DD':    DD,
        'config_parking_data': json.dumps(parking_json),
        'config_parking_config': json.dumps(parking_config)
    })


#############################################################################
########   parking/map                                #######################
#############################################################################

def parking_map(request):

    reader = codecs.getreader("utf-8")
    try:
        parking_list = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/parking/list'
        )))
    except:
        parking_list = None

    try:
        # //debug hardcoded cam_park_rss into parking/map occupancy feed request
        parking_feed = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/feed/now/cam_park_rss'
        )))
    except:
        parking_feed = None

    return render(request, 'parking/parking_map.html', {
        'config_parking_list': json.dumps(parking_list),
        'config_parking_feed': json.dumps(parking_feed)
    })


#############################################################################
########   parking/list                               #######################
#############################################################################

def parking_list(request):

    reader = codecs.getreader("utf-8")
    try:
        parking_list = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/parking/list'
        )))
    except:
        parking_list = None

    try:
        # //debug hardcoded cam_park_rss into parking/map occupancy feed request
        parking_feed = json.load(reader(urlopen(
            settings.API_ENDPOINT+'/api/dataserver/feed/now/cam_park_rss'
        )))
    except:
        parking_feed = None

    return render(request, 'parking/parking_list.html', {
        'config_parking_list': json.dumps(parking_list),
        'config_parking_feed': json.dumps(parking_feed)
    })
