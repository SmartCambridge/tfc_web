
'''
The functions used by the build_download_data command to extract
Bluetooth-derived journey data and store it in CVS files.
'''

from collections.abc import Mapping 
import json
import logging

from .util import epoch_to_text

logger = logging.getLogger(__name__)


# Data extractors receive a list of file names and a CSV writer object.
# They are expected to write appropriate headers to the CSV writer and
# then extract relevant fields from each file, format them as necessary
# and write the result CSV writer.


def btjourney_journey_extractor(files, writer):

    logger.debug('In btjourney_journey_extractor')
    fields = ('id', 'ts', 'ts_text', 'time', 'period', 'travelTime', 'normalTravelTime')
    writer.writerow(fields)

    for file in files:
        try:
            logger.debug('Processing %s', file)
            with open(file) as reader:
                for line in reader:
                    data = json.loads(line)
                    data['ts_text'] = epoch_to_text(data['ts'])
                    # For reasons unknown, the period field in journey data
                    # is occasionally an empty object rather than an integer.
                    # In particular this has been observed for very recently
                    # created links (see e.g. CAMBRIDGE_JTMS|9800YRAA8RIZ on
                    # 2020-02-16)
                    if isinstance(data['period'], Mapping):
                        data['period'] = None
                    writer.writerow([data.get(f) for f in fields])
        except OSError as e:
            logger.error('Error opening %s: %s', file, e)
        except json.decoder.JSONDecodeError as e:
            logger.error('Error decoding %s: %s', file, e)


def btjourney_link_extractor(files, writer):

    logger.debug('In btjourney_link_extractor')
    fields = ('id', 'ts', 'ts_text', 'name', 'description', 'sites', 'length')
    writer.writerow(fields)

    for file in files:
        try:
            logger.debug('Processing %s', file)
            with open(file) as reader:
                for line in reader:
                    data = json.loads(line)
                    data['ts_text'] = epoch_to_text(data['ts'])
                    data['sites'] = '|'.join(data['sites'])
                    writer.writerow([data.get(f) for f in fields])
        except OSError as e:
            logger.error('Error opening %s: %s', file, e)
        except json.decoder.JSONDecodeError as e:
            logger.error('Error decoding %s: %s', file, e)


def btjourney_route_extractor(files, writer):

    logger.debug('In btjourney_route_extractor')
    fields = ('id', 'ts', 'ts_text', 'name', 'description', 'sites', 'links', 'length')
    writer.writerow(fields)

    for file in files:
        try:
            logger.debug('Processing %s', file)
            with open(file) as reader:
                for line in reader:
                    data = json.loads(line)
                    data['ts_text'] = epoch_to_text(data['ts'])
                    data['sites'] = '|'.join(data['sites'])
                    data['links'] = '|'.join(data['links'])
                    writer.writerow([data.get(f) for f in fields])
        except OSError as e:
            logger.error('Error opening %s: %s', file, e)
        except json.decoder.JSONDecodeError as e:
            logger.error('Error decoding %s: %s', file, e)


def btjourney_site_extractor(files, writer):

    logger.debug('In btjourney_site_extractor')
    fields = ('id', 'ts', 'ts_text', 'name', 'description', 'latitude', 'longitude')
    writer.writerow(fields)

    for file in files:
        try:
            logger.debug('Processing %s', file)
            with open(file) as reader:
                for line in reader:
                    data = json.loads(line)
                    data['ts_text'] = epoch_to_text(data['ts'])
                    data['latitude'] = data['location']['lat']
                    data['longitude'] = data['location']['lng']
                    writer.writerow([data.get(f) for f in fields])
        except OSError as e:
            logger.error('Error opening %s: %s', file, e)
        except json.decoder.JSONDecodeError as e:
            logger.error('Error decoding %s: %s', file, e)
