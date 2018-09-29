import json
import logging
import pyofo
import requests

from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings


logger = logging.getLogger(__name__)


def bikes(request):
    '''
    Retrieve shared bikes from around the area from ofo and mobike
    '''
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    assert lat, 'No latitude'
    assert lng, 'No longitude'

    cache_key = "bikes!{0}!{1}".format(lat, lng)
    data = cache.get(cache_key)

    if data:
        logger.info('Cache hit for %s', cache_key)
    else:
        logger.info('Cache miss for %s', cache_key)

        # Retrieve ofo bikes
        pyofo.set_token(settings.OFO_TOKEN)
        ofo = pyofo.Ofo()
        ro = ofo.nearby_ofo_car(lat=lat, lng=lng)
        ofo_data = json.loads(ro.text)

        # Retrieve mobike bikes
        rm = requests.post('https://mwx.mobike.com/mobike-api/rent/nearbyBikesInfo.do',
                           data='latitude=%s&longitude=%s' % (lat, lng),
                           headers={
                               'content-type': 'application/x-www-form-urlencoded',
                               'user-agent': 'Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M; wv) '
                                             'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/60.0.3112.107 '
                                             'Mobile Safari/537.36'
                           })
        mobike_data = json.loads(rm.text)

        data = {
            'ofo': ofo_data,
            'mobike': mobike_data
        }

        # Set cache for 15 minutes
        cache.set(cache_key, data, timeout=900)

    # Check if an error has happened
    status = 500 if data['ofo']['errorCode'] != 200 or data['mobike']['code'] != 0 else 200

    return JsonResponse(data, status=status)
