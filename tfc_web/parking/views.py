import codecs
import requests
import json
from datetime import date
from urllib.request import urlopen
from django.http import JsonResponse
from django.shortcuts import render

#############################################################################
########   parking/  home page                        #######################
#############################################################################

def index(request):
    return render(request, 'parking/home.html', {})

#############################################################################
########   parking/plot/<parking_id>?date=YYYY-MM-DD  #######################
#############################################################################

def parking_plot(request, parking_id):

    today = date.today().strftime('%Y-%m-%d')
    
    user_date = request.GET.get('date')
    if not user_date:
        user_date = today

    yyyy = user_date[0:4]
    MM = user_date[5:7]
    dd = user_date[8:10]
    
    reader = codecs.getreader("utf-8")
    try:
        parking_json = json.load(reader(urlopen(
            'http://tfc-app2.cl.cam.ac.uk/api/dataserver/parking/occupancy/'+parking_id+'?date='+yyyy+'-'+MM+'-'+dd
        )))
    except:
        parking_json = None

    try:
        parking_config = json.load(reader(urlopen(
            'http://tfc-app2.cl.cam.ac.uk/api/dataserver/parking/config/'+parking_id
        )))
    except:
        parking_config = None
    
    return render(request, 'parking/parking_plot.html', {
        'config_date':  user_date,
        'config_parking_id': parking_id,
        'config_yyyy' : yyyy,
        'config_MM':    MM,
        'config_dd':    dd,
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
            'http://tfc-app2.cl.cam.ac.uk/api/dataserver/parking/list'
        )))
    except:
        parking_list = None

    return render(request, 'parking/parking_map.html', {
        'config_parking_list': json.dumps(parking_list)
    })

