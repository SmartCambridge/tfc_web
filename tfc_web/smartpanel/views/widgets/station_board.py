import logging
# for widget support views
from django.core.cache import cache
from django.shortcuts import render
from django.conf import settings
#    ... for station_board
import zeep


logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# Support routines for the station_board widget

WSDL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2017-10-01'
STATION_ABBREV = { 'London Kings Cross': 'London Kings X',
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

    cache_key = "station_board!{0}!{1}".format(station, offset);
    data = cache.get(cache_key)
    if data:
        logger.info('Cache hit for %s', cache_key)
    else:
        logger.info('Cache miss for %s', cache_key)
        client = zeep.Client(wsdl=WSDL)
        data = client.service.GetDepartureBoard(numRows=50,crs=station,
            _soapheaders={"AccessToken": settings.NRE_API_KEY},
            timeOffset=offset)
        # Apply station abbreviations
        for service in data['trainServices']['service']:
            dest = service['destination']['location'][0]['locationName']
            if dest in STATION_ABBREV:
                service['destination']['location'][0]['locationName'] = STATION_ABBREV[dest]
        cache.set(cache_key,data,30)

    #return HttpResponse('Hello world!')

    return render(request, 'smartpanel/station_board.html', {'data': data})
