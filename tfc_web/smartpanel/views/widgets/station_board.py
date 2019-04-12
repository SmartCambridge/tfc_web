import logging
from django.core.cache import cache
from django.shortcuts import render
from django.conf import settings
from django.http.response import HttpResponseBadRequest
import zeep
import zeep.transports
import zeep.cache
import re
import os
import sys

logger = logging.getLogger(__name__)

WSDL = os.path.join(settings.BASE_DIR, 'smartpanel', 'wsdl', 'OpenLDBWS_wsdl_2017-10-01.xml')

STATION_ABBREV = {
  'London Kings Cross': 'London Kings X',
  'London Liverpool Street': 'London Liv. St',
  'Birmingham New Street': "Birm'ham New St",
  'Cambridge North': "Cambridge Nth",
}


def station_board(request, ver=''):
    '''
    Retrieve a 'DepartureBoard' from National Rail Enquiries
    and render it as a web page
    '''
    station = request.GET.get('station', '')
    if station == '':
        return HttpResponseBadRequest('Missing station identifier')
    offset = int(request.GET.get('offset', 0))

    current_key = "station_board_current!{0}!{1}".format(station, offset)
    lng_key = "station_board_lng!{0}!{1}".format(station, offset)

    data = cache.get(current_key)
    if data:
        logger.info('Cache hit for %s', current_key)

    else:
        logger.info('Cache miss for %s', current_key)
        data = {'messages': [], 'services': []}

        try:

            client = zeep.Client(wsdl=WSDL)
            raw_data = client.service.GetDepartureBoard(
                numRows=50, crs=station,
                _soapheaders={"AccessToken": settings.NRE_API_KEY},
                timeOffset=offset
            )

            data['locationName'] = raw_data['locationName']
            data['generatedAt'] = raw_data['generatedAt'].strftime("%H:%M")

            if raw_data['nrccMessages']:
                for message in raw_data['nrccMessages']['message']:
                    for key in message:
                        data['messages'].append(re.sub('<[^<]+?>', '', message[key]))
            if len(data['messages']) > 1:
                data['messages'] = ['Multiple travel alerts in force - see www.nationalrail.co.uk for details.']

            if raw_data['trainServices']:
                for service in raw_data['trainServices']['service']:
                    this_service = {}
                    this_service['std'] = service['std']
                    this_service['etd'] = service['etd']
                    this_service['platform'] = service['platform'] or ''
                    dest = service['destination']['location'][0]['locationName']
                    if dest in STATION_ABBREV:
                        dest = STATION_ABBREV[dest]
                    this_service['destination'] = dest
                    data['services'].append(this_service)

            cache.set(lng_key, data, timeout=30*60)

        except:
            logger.error(
                "Error retrieving station board for %s: %s %s",
                station,
                sys.exc_info()[0],
                sys.exc_info()[1])
            data = cache.get(lng_key)
            if data:
                logger.info('Cache hit for %s', lng_key)
            else:
                logger.info('Cache miss for %s', lng_key)
                data = {'messages': [], 'services': []}

        # Whatever happens, cache what we got so we don't keep hitting the API
        finally:
            cache.set(current_key, data, timeout=30)

    template = 'smartpanel/station_board{0}.html'.format(ver)
    return render(request, template, {'data': data})
