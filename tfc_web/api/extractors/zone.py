
'''
The set of functions used by the build_download_data command to extract data
and store it in CVS files.
'''

import json
import logging
import re

from .util import epoch_to_text


logger = logging.getLogger(__name__)


# Data extractors receive a list of file names and a CSV writer object.
# They are expected to write appropriate headers to the CSV writer and
# then extract relevant fields from each file, format them as necessary
# and write the result CSV writer.


def zone_extractor(files, writer):

    logger.debug('In zone_extractor')
    fields = ('zone_id', 'ts', 'ts_text', 'duration', 'distance', 'ts_delta', 'vehicle_id')
    writer.writerow(fields)

    for file in files:
        logger.debug('Processing %s', file)
        with open(file) as reader:
            for line in reader:
                data = json.loads(line)
                data['ts_text'] = epoch_to_text(data['ts'])
                data['zone_id'] = data['module_id']
                if 'distance' in data:
                    data['distance'] = round(data['distance'])
                writer.writerow([data.get(f) for f in fields])

# Metadata extractors for each storage type. They receive a single filename
# in 'files' and a CSV writer object.


def zone_metadata_extractor(files, writer):

    logger.debug('In zone_metadata_extractor')
    fields = ('zone_id', 'zone_reverse_id', 'zone_name', 'zone_map', 'zone_center', 'zone_zoom', 'zone_finish_index', 'zone_path')
    writer.writerow(fields)

    assert len(files) == 1, 'Expecting exactly one file'
    logger.debug('Processing %s', files[0])
    with open(files[0]) as reader:
        for zone in json.load(reader)['zone_list']:
            data = {re.sub(r'\.', '_', key): value for (key, value) in zone.items()}
            data['zone_center'] = '{0[lat]}|{0[lng]}'.format(data['zone_center'])
            data['zone_path'] = '|'.join(['{0[lat]}|{0[lng]}'.format(point) for point in data['zone_path']])
            writer.writerow([data.get(f) for f in fields])
