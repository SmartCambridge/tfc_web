
'''
The set of functions used by the build_download_data command to extract data
and store it in CVS files.
'''

import json
import logging

from .util import epoch_to_text

logger = logging.getLogger(__name__)


# Data extractors receive a list of file names and a CSV writer object.
# They are expected to write appropriate headers to the CSV writer and
# then extract relevant fields from each file, format them as necessary
# and write the result CSV writer.


def bus_extractor(files, writer):

    logger.debug('In bus_extractor')
    fields = (
        'ts', 'ts_text', 'VehicleRef', 'LineRef', 'DirectionRef',
        'OperatorRef', 'OriginRef', 'OriginName', 'DestinationRef',
        'DestinationName', 'OriginAimedDepartureTime', 'Longitude',
        'Latitude', 'Bearing', 'Delay'
    )
    writer.writerow([f for f in fields])

    for file in files:
        try:
            logger.debug('Processing %s', file)
            with open(file) as reader:
                data = json.load(reader)
                for record in data['request_data']:
                    record['ts'] = record['acp_ts']
                    record['ts_text'] = epoch_to_text(record['acp_ts'])
                    writer.writerow([record.get(f) for f in fields])
        except OSError as e:
            logger.error('Error opening %s: %s', file, e)
        except json.decoder.JSONDecodeError as e:
            logger.error('Error decoding %s: %s', file, e)
