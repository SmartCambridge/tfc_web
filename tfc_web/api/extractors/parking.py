
'''
The functions used by the build_download_data command to extract car
park dataand store it in CVS files.
'''

import json
import logging

from .util import epoch_to_text

logger = logging.getLogger(__name__)


# Data extractors receive a list of file names and a CSV writer object.
# They are expected to write appropriate headers to the CSV writer and
# then extract relevant fields from each file, format them as necessary
# and write the result CSV writer.


def cam_park_rss_extractor(files, writer):

    logger.debug('In cam_park_rss_extractor')
    fields = ('parking_id', 'ts', 'ts_text', 'spaces_capacity', 'spaces_occupied', 'spaces_free')
    writer.writerow(fields)

    for file in files:
        logger.debug('Processing %s', file)
        with open(file) as reader:
            for line in reader:
                data = json.loads(line)
                data['ts_text'] = epoch_to_text(data['ts'])
                writer.writerow([data.get(f) for f in fields])


# Metadata extractors for each storage type. They receive a single filename
# in 'files' and a CSV writer object.

def cam_park_rss_metadata_extractor(files, writer):

    logger.debug('In cam_park_rss_metadata_extractor')
    fields = ('parking_id', 'parking_name', 'parking_type', 'latitude', 'longitude')
    writer.writerow(fields)

    assert len(files) == 1, 'Expecting exactly one file'
    logger.debug('Processing %s', files[0])
    with open(files[0]) as reader:
        data = json.load(reader)
        for carpark in data['parking_list']:
            writer.writerow([carpark.get(f) for f in fields])
