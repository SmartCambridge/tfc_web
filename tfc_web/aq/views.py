import codecs
import requests
import json
from datetime import date, timedelta, datetime
from urllib.request import urlopen
from django.http import JsonResponse
from django.shortcuts import render

# test on port 8099 with API_URL = 'http://localhost/test/api/'
API_URL = 'http://localhost/api/'

#############################################################################
########   AQ HOMEPAGE                                #######################
#############################################################################

def index(request):
    return render(request, 'aq/home.html', {})

#####################################################################################
########   AQ PLOT                                                                  #
########   aq/plot/<StationID>?[sensor_type=CO][&feed_id=cam_aq][&date=YYYY-MM-DD]  #
#####################################################################################

def aq_plot(request, station_id):

    today = date.today()

    # get ?date=YYYY-MM-DD if it's there, otherwise use today's date    
    user_date = request.GET.get('date')
    if not user_date:
        q_date = today
    else:
        q_date = datetime.strptime(user_date, '%Y-%m-%d').date()

    sensor_type = request.GET.get('sensor_type')
    if not sensor_type:
        sensor_api_string = ''
    else:
        sensor_api_string = '&sensor_type='+sensor_type

    feed_id = request.GET.get('feed_id')
    if not feed_id:
        feed_api_string = ''
    else:
        feed_api_string = '&feed_id='+feed_id

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

    sensor_json = []

    for days in days_list:
        try:
            this_date = (q_date-timedelta(days=days)).strftime('%Y-%m-%d')
            this_YYYY = this_date[0:4]
            this_MM   = this_date[5:7]
            this_DD   = this_date[8:10]
            date_api_string = '?date='+this_YYYY+'-'+this_MM+'-'+this_DD

            sensor_json.append( json.load(reader(urlopen(
                API_URL+'dataserver/aq/reading/'+station_id+date_api_string+feed_api_string+sensor_api_string
            ))))
        except:
            pass

    try:
        station_config = json.load(reader(urlopen(
            API_URL+'dataserver/aq/config/'+station_id
        )))
    except:
        station_config = None

    user_date = q_date.strftime('%Y-%m-%d')
    YYYY = user_date[0:4]
    MM   = user_date[5:7]
    DD   = user_date[8:10]

    return render(request, 'aq/aq_plot.html', {
        'config_date':  user_date,
        'config_station_id': station_id,
        'config_sensor_type': sensor_type,
        'config_YYYY' : YYYY,
        'config_MM':    MM,
        'config_DD':    DD,
        'config_sensor_data': json.dumps(sensor_json),
        'config_station_config': json.dumps(station_config)
    })

#############################################################################
########        AQ MAP                                #######################
#############################################################################

def aq_map(request):

    reader = codecs.getreader("utf-8")
    try:
        aq_list = json.load(reader(urlopen(
            API_URL+'dataserver/aq/list'
        )))
    except:
        aq_list = None

    return render(request, 'aq/aq_map.html', {
        'config_aq_list': json.dumps(aq_list)

    })

#############################################################################
########        aq/list                               #######################
#############################################################################

def aq_list(request):

    reader = codecs.getreader("utf-8")
    try:
        aq_list = json.load(reader(urlopen(
            API_URL+'dataserver/aq/list'
        )))
    except:
        aq_list = None

    return render(request, 'aq/aq_list.html', {
        'config_aq_list': json.dumps(aq_list)

    })

