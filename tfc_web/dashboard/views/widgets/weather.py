# for widget support views
from django.core.cache import cache
import logging
from django.conf import settings
from django.shortcuts import render
#    ... for weather
import requests
from collections import OrderedDict
import datetime
import pytz
import iso8601
from django.contrib.staticfiles.templatetags.staticfiles import static


logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# Support routines for the weather widget

METOFFICE_API = 'http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/'

# Met Office 'Significant weather' code to text description
weather_descriptions = {
    "NA": "Not available",
    "0": "Clear night",
    "1": "Sunny day",
    "2": "Partly cloudy",
    "3": "Partly cloudy",
    "4": "Not used",
    "5": "Mist",
    "6": "Fog",
    "7": "Cloudy",
    "8": "Overcast",
    "9": "Light rain shower",
    "10": "Light rain shower",
    "11": "Drizzle",
    "12": "Light rain",
    "13": "Heavy rain shower",
    "14": "Heavy rain shower",
    "15": "Heavy rain",
    "16": "Sleet shower",
    "17": "Sleet shower",
    "18": "Sleet",
    "19": "Hail shower",
    "20": "Hail shower",
    "21": "Hail",
    "22": "Light snow shower",
    "23": "Light snow shower",
    "24": "Light snow",
    "25": "Heavy snow shower",
    "26": "Heavy snow shower",
    "27": "Heavy snow",
    "28": "Thunder shower",
    "29": "Thunder shower",
    "30": "Thunder",
}

# Met Office 'Significant weather' code to RNS Weather Icon
# https://iconstore.co/icons/rns-weather-icons/
weather_icon = {
    "0": "05",
    "1": "01",
    "2": "18",
    "3": "17",
    "5": "39",
    "6": "39",
    "7": "16",
    "8": "16",
    "9": "50",
    "10": "49",
    "11": "25",
    "12": "48",
    "13": "47",
    "14": "46",
    "15": "45",
    "16": "33",
    "17": "32",
    "18": "31",
    "19": "53",
    "20": "52",
    "21": "51",
    "22": "33",
    "23": "32",
    "24": "31",
    "25": "33",
    "26": "32",
    "27": "31",
    "28": "30",
    "29": "29",
    "30": "28",
}


def mph_to_descr(speed):
    '''
    Convert wind in MPH to description.
    Based on US Weather Bureau description from
    https://www.windows2universe.org/earth/Atmosphere/wind_speeds.html
    and Beaufort Scales from
    https://en.wikipedia.org/wiki/Beaufort_scale
    '''
    if speed < 1:        # 0
        return 'Calm'
    elif speed < 8:      # 1, 2
        return 'Light'
    elif speed < 8:      # 3, 4
        return 'Moderate'
    elif speed < 19:     # 5
        return 'Fresh'
    elif speed < 39:     # 6, 7
        return 'Strong'
    elif speed < 73  :   # 8, 9, 10, 11
        return 'Gale'
    else:                # 12 upward
        return 'huricane'


def extract_weather_results(data):
    '''
    Walk the (assumed date/time ordered) forecast data returned by the
    Met Office API and finding the forecast dated immediately before
    now and the next two, without making any assumptions about the
    interval between forecasts
    '''
    previous = None
    results = []
    now = datetime.datetime.now(tz=pytz.UTC)
    for period in data["SiteRep"]["DV"]["Location"]["Period"]:
        day = iso8601.parse_date(period["value"][0:10],default_timezone=datetime.timezone.utc)
        for rep in period["Rep"]:
            rep['description'] = weather_descriptions.get(rep['W'],'')
            if weather_icon.get(rep['W'],''):
                rep['icon'] = static('dashboard/widgets/weather/icons/weather_icon-' +
                              weather_icon.get(rep['W'],'') +'.png')
            logger.info(rep['icon'])
            rep['wind_desc'] = mph_to_descr(int(rep['S']))
            timestamp = day + datetime.timedelta(minutes=int(rep["$"]))
            if timestamp > now and not results:
                results.append(previous)
            if timestamp > now:
                results.append((timestamp,rep))
            if len(results) >= 3:
                return(results)
            previous = ((timestamp,rep))
    return(results)


def weather(request):
    '''
    Extract forecast information from the Met Office Data feed
    and render it for inclusion in a widgit
    '''
    location = request.GET.get('location', '')
    assert location, 'No location code found'

    cache_key = "weather!{0}".format(location);
    data = cache.get(cache_key)
    if data:
        logger.info('Cache hit for %s', cache_key)
    else:
        logger.info('Cache miss for %s', cache_key)
        r = requests.get(METOFFICE_API + location, {
            "res": "3hourly",
            "key": settings.METOFFICE_KEY
        })
        r.raise_for_status()
        # https://stackoverflow.com/questions/35042216/requests-module-return-json-with-items-unordered
        data = r.json(object_pairs_hook=OrderedDict)
        cache.set(cache_key,data,timeout=500)

    results = extract_weather_results(data)

    logger.info(results)

    return render(request, 'dashboard/weather.html', {
        "results": results,
        "location": data["SiteRep"]["DV"]["Location"]["name"],
        "issued": iso8601.parse_date(data["SiteRep"]["DV"]["dataDate"]),
    })

# ----------------------------------------------------------------------
