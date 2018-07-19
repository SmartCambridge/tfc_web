from collections import OrderedDict
from datetime import datetime, time, timedelta
import iso8601
import logging
import pytz
import requests
import sys

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import render


logger = logging.getLogger(__name__)

METOFFICE_API = 'http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/'

uk_tz = pytz.timezone('Europe/London')
utc_tz = pytz.utc

# The forecasts to display
forecast_breakpoints = [
        # forecast_time: use the forecast nearest this time
        # display_until: display this forecast until this time
        # label: how to label the forecast
        # [all these times are implicitly 'UK local']
        {'forecast_time': time(hour=8, minute=30),
         'display_until': time(hour=9, minute=30),
         'label': 'morning'
         },
        {'forecast_time': time(hour=13, minute=0),
         'display_until': time(hour=14, minute=0),
         'label': 'lunchtime'
         },
        {'forecast_time': time(hour=17, minute=0),
         'display_until': time(hour=18, minute=0),
         'label': 'evening'
         }
    ]

# Met Office 'Significant weather' code to text description
weather_descriptions = {
    "NA": "Not available",
    "0": "Clear",
    "1": "Sunny",
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
    elif speed < 73:   # 8, 9, 10, 11
        return 'Gale'
    else:                # 12 upward
        return 'huricane'


def get_forecast_list(breakpoints):
    '''
    Given a list of display times, return a list of the forecasts
    that should be displayed
    '''

    now = uk_tz.localize(datetime.now())
    max_forecasts = 8

    # Find the first breakpoint with display_until after now (wrapping
    # to tomorrow if necessary)
    row = 0
    today = now.date()
    while row < len(forecast_breakpoints):
        display_until = uk_tz.localize(
            datetime.combine(today, breakpoints[row]['display_until'])
        )
        if display_until > now:
            break
        row += 1
    else:
        row = 0
        today = today + timedelta(days=1)

    # Build and return an array of the UTC forecast times and corresponding
    # labels that we want, starting at the row identified above and wrapping
    # to tomorrow if necessary
    results = []
    qualifier = 'this '
    while len(results) < max_forecasts:
        forecast_datetime = uk_tz.localize(
            datetime.combine(today, breakpoints[row]['forecast_time'])
        ).astimezone(utc_tz)
        if forecast_datetime.date() == now.date():
            qualifier = 'this'
        elif forecast_datetime.date() == now.date() + timedelta(days=1):
            qualifier = 'tomorrow'
        else:
            qualifier = forecast_datetime.strftime('%A')
        results.append(
            {'time': forecast_datetime,
             'label': (qualifier + ' ' + breakpoints[row]['label']).capitalize()
             }
        )
        row += 1
        if row >= len(breakpoints):
            row = 0
            today = today + timedelta(days=1)

    return results


def extract_weather_results(forecasts, data):
    '''
    Walk the (assumed date/time ordered) forecasts returned by the
    Met Office API and, for each entry in forecasts select the one that's
    closest to the corresponding timestamp (without making any assumptions
    about the timing of the forecasts or the interval between them
    '''

    results = [None] * len(forecasts)
    current = None
    now = datetime.now(tz=utc_tz)
    # For each day...
    for period in data["SiteRep"]["DV"]["Location"]["Period"]:
        day = iso8601.parse_date(
            period["value"][0:10], default_timezone=utc_tz
        )
        # ...for each forecast in that day
        for rep in period["Rep"]:
            rep['day'] = day
            rep['timestamp'] = day + timedelta(minutes=int(rep["$"]))
            # ...see if it's a best match for a requested forecast
            for counter, wanted in enumerate(forecasts):
                if results[counter] is None:
                    results[counter] = rep
                else:
                    if (abs(rep['timestamp'] - wanted['time']) <
                       abs(results[counter]['timestamp'] - wanted['time'])):
                        results[counter] = rep
            # ...and see if it's a best match for 'now'
            if current is None:
                current = rep
            else:
                if (abs(rep['timestamp'] - now) < abs(current['timestamp'] - now)):
                    current = rep

    # Enhance the values being returned
    for counter, rep in enumerate(results):
        rep['description'] = weather_descriptions.get(rep['W'], '')
        rep['icon'] = 'smartpanel/widgets/weather/icons/weather_icon-' + weather_icon.get(rep['W'], '') + '.png'
        rep['wind_desc'] = mph_to_descr(int(rep['S']))
        rep['title'] = forecasts[counter]['label']

    # Push current on the front of results if it's different from the
    # existing first result
    if current['timestamp'] < results[0]['timestamp']:
        current['description'] = weather_descriptions.get(current['W'], '')
        current['icon'] = 'smartpanel/widgets/weather/icons/weather_icon-' + weather_icon.get(current['W'], '') + '.png'
        current['wind_desc'] = mph_to_descr(int(current['S']))
        current['title'] = 'Now'
        results.insert(0, current)

    return results


def parse_data(forecasts, data):

    results = extract_weather_results(forecasts, data)
    for result in results:
        result['timestamp_text'] = result['timestamp'].astimezone(tz=None).strftime('%H:%M')

    issued = iso8601.parse_date(data["SiteRep"]["DV"]["dataDate"]).astimezone(tz=None)
    now = uk_tz.localize(datetime.now())
    if issued.date() == now.date():
        issued = issued.strftime('%H:%M')
    elif issued.date() == now.date() - timedelta(days=1):
        issued = issued.strftime('%H:%M yesterday')
    else:
        issued = issued.strftime('%A %H:%M')

    location_name = data["SiteRep"]["DV"]["Location"]["name"]

    return (results, location_name, issued)


def weather(request):
    '''
    Extract forecast information from the Met Office Data feed
    and render it for inclusion in a widgit
    '''
    location = request.GET.get('location', '')
    assert location, 'No location code found'

    forecasts = get_forecast_list(forecast_breakpoints)

    current_key = "weather_current!{0}".format(location)
    lng_key = "weather_lng!{0}".format(location)

    data = cache.get(current_key)

    # If we got a value from the cache, use that
    if data is not None:
            logger.info('Cache hit for %s', current_key)
    # Otherwise, retrieve data from the MetOffice
    else:
        logger.info('Cache miss for %s', current_key)
        data = ''
        try:
            r = requests.get(METOFFICE_API + location, {
                "res": "3hourly",
                "key": settings.METOFFICE_KEY
            })
            r.raise_for_status()
            # https://stackoverflow.com/questions/35042216/requests-module-return-json-with-items-unordered
            data = r.json(object_pairs_hook=OrderedDict)
        except:
            logger.error(
                "Error retrieving weather data for %s: %s %s",
                location,
                sys.exc_info()[0],
                sys.exc_info()[1])
        # Whatever happens, cache what we got so we don't keep hitting the API
        finally:
            cache.set(current_key, data, timeout=600)

    # Try to parse whatever we've got. if that works, cache it
    # as the 'last known good' version for ever
    try:
        (results, location_name, issued) = parse_data(forecasts, data)
        cache.set(lng_key, data, timeout=None)
    except:
        logger.error(
            "Error parsing current weather data for %s: %s %s",
            location,
            sys.exc_info()[0],
            sys.exc_info()[1])
        logger.info("Data was: '%s'", data)
        # Fall back to the LNG version, if that's available
        lng_data = cache.get(lng_key)
        if lng_data is not None:
            logger.info('Cache hit for %s', lng_key)
            (results, location_name, issued) = parse_data(forecasts, lng_data)
        else:
            logger.info('Cache miss for %s', lng_key)
            results = []
            location_name = 'Unknown'
            issued = ''

    return render(request, 'smartpanel/weather.html', {
        "results": results,
        "location": location_name.title(),
        "issued": issued
        }
    )
