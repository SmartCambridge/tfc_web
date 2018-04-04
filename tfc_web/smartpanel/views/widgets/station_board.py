import logging
from django.core.cache import cache
from django.shortcuts import render
from django.conf import settings
import zeep
import re

logger = logging.getLogger(__name__)

WSDL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2017-10-01'

STATION_ABBREV = {
  'London Kings Cross': 'London Kings X',
  'London Liverpool Street': 'London Liv. St',
  'Birmingham New Street': "Birm'ham New St",
}


def station_board(request):
    '''
    Retrieve a 'DepartureBoard' from National Rail Enquiries
    and render it as a web page
    '''
    station = request.GET.get('station', '')
    assert station, 'No station code found'
    offset = int(request.GET.get('offset', 0))

    cache_key = "station_board!{0} {1}".format(station, offset)
    data = cache.get(cache_key)
    if data:
        logger.info('Cache hit for %s', cache_key)

    else:
        logger.info('Cache miss for %s', cache_key)
        data = {'messages': [], 'services': []}

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

        for service in raw_data['trainServices']['service']:
            this_service = {}
            this_service['std'] = service['std']
            this_service['etd'] = service['etd']
            dest = service['destination']['location'][0]['locationName']
            if dest in STATION_ABBREV:
                dest = STATION_ABBREV[dest]
            this_service['destination'] = dest
            data['services'].append(this_service)

        cache.set(cache_key, data, timeout=30)

    return render(request, 'smartpanel/station_board.html', {'data': data})
