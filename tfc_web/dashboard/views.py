import json
import sys
from collections import defaultdict
from django.shortcuts import redirect, get_object_or_404, render
from dashboard.models import Layout
import zeep
from django.core.cache import cache
import logging
from django.http import HttpResponse
from django.conf import settings

logger = logging.getLogger(__name__)

def design(request):
    if request.method == "POST":
        if 'name' in request.POST and 'design' in request.POST and request.POST['design']:
            layout = Layout.objects.create(name=request.POST['name'], design=json.loads(request.POST['design']))
            return redirect('dashboard-layout-config', layout.id)
    return render(request, 'dashboard/design.html')


def generate_layout_configuration(layout):
    confdata = {}
    for key, value in layout.design.items():
        confdata[key] = {'design': layout.design[key]}
        if layout.configuration and key in layout.configuration:
            confdata[key]['configuration'] = layout.configuration[key]
    return confdata


def layout_config(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    if request.method == "POST" and 'data' in request.POST:
        data = json.loads(request.POST['data'])
        for key, value in data.items():
            data[key.strip("widget-")] = data.pop(key)
        layout.configuration = data
        layout.save()
    return render(request, 'dashboard/layout_config.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout)})


def layout(request, layout_id):
    layout = get_object_or_404(Layout, id=layout_id)
    return render(request, 'dashboard/layout.html',
                  {'layout': layout, 'confdata': generate_layout_configuration(layout)})


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

    return render(request, 'dashboard/station_board.html', {'data': data})
