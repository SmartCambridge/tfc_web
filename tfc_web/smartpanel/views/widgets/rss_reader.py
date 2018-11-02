from datetime import datetime, time, timedelta
import iso8601
import logging
import pytz
import requests
import sys
import xmltodict

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import render


logger = logging.getLogger(__name__)

RSS_URL = 'https://talks.cam.ac.uk/show/rss/6330';

uk_tz = pytz.timezone('Europe/London')
utc_tz = pytz.utc

def rss_reader(request):
    '''
    HTTP GET the required RSS feed
    and render it for inclusion in a widgit
    '''
    title = request.GET.get('title', '')

    current_key = "rss_reader_current!{0}".format(title)
    lng_key = "rss_reader_lng!{0}".format(title)

    rss_xml = cache.get(current_key)

    # If we got a value from the cache, use that
    if rss_xml is not None:
            logger.info('Cache hit for %s', current_key)
    # Otherwise, retrieve data from the MetOffice
    else:
        logger.info('Cache miss for %s', current_key)
        rss_xml = ''
        try:
            r = requests.get(RSS_URL)
            r.raise_for_status()
            # https://stackoverflow.com/questions/35042216/requests-module-return-json-with-items-unordered
            rss_xml = r.text
        except:
            logger.error("Error retrieving rss feed for %s: %s %s",
            title,
            sys.exc_info()[0],
            sys.exc_info()[1])
        # Whatever happens, cache what we got so we don't keep hitting the API
        finally:
            cache.set(current_key, rss_xml, timeout=600)

    # Try to parse whatever we've got. if that works, cache it
    # as the 'last known good' version for ever
    try:
        cache.set(lng_key, rss_xml, timeout=None)
    except:
        logger.error("Error cacheing current rss feed for %s: %s %s",
            title,
            sys.exc_info()[0],
            sys.exc_info()[1])
        logger.info("rss feed %s was: '%s'", title, rss_xml)
        # Fall back to the LNG version, if that's available
        lng_data = cache.get(lng_key)
        if lng_data is not None:
            logger.info('Cache hit for %s', lng_key)
            rss_xml = lng_data
        else:
            logger.info('Cache miss for %s', lng_key)
            title = 'RSS title unknown'

    #rss_xml = "debug"
    return render(request, 'smartpanel/rss_reader.html', { "rss_xml": rss_xml }
    )
