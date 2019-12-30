
'''
The set of functions used by the build_download_data command to extract data
and store it in CVS files.
'''

import json
import logging

import dateutil.parser

from .util import epoch_to_text

logger = logging.getLogger(__name__)


# Data extractors receive a list of file names and a CSV writer object.
# They are expected to write appropriate headers to the CSV writer and
# then extract relevant fields from each file, format them as necessary
# and write the result CSV writer.


def aq_header_extractor(files, writer):

    logger.debug('In aq_files_extractor')

    fields = (
        'station_id', 'sensor_type', 'ts', 'ts_text',
        'BatteryVoltage', 'COFinal', 'COOffset', 'COPrescaled', 'COScaled',
        'COSerialNumber', 'COSlope', 'COStatus', 'GasProtocol', 'GasStatus',
        'Humidity', 'Latitude', 'Longitude', 'Name', 'NO2Final', 'NO2Offset',
        'NO2Prescaled', 'NO2Scaled', 'NO2SerialNumber', 'NO2Slope', 'NO2Status',
        'NOFinal', 'NOOffset', 'NOPrescaled', 'NOScaled', 'NOSerialNumber',
        'NOSlope', 'NOStatus', 'O3Final', 'O3Offset', 'O3Prescaled', 'O3Scaled',
        'O3SerialNumber', 'O3Slope', 'O3Status', 'OtherInfo', 'P1', 'P2', 'P3',
        'ParticleNumber', 'ParticleProtocol', 'ParticleStatus', 'PM10Final',
        'PM10Offset', 'PM10Output', 'PM10PreScaled', 'PM10Slope', 'PM1Final',
        'PM1Offset', 'PM1Output', 'PM1PreScaled', 'PM1Slope', 'PM2_5Final',
        'PM2_5Offset', 'PM2_5OutPut', 'PM2_5PreScaled', 'PM2_5Slope',
        'PMTotalOffset', 'PMTotalPreScaled', 'PMTotalSlope', 'PodFeaturetype',
        'Pressure', 'SerialNo', 'SO2Final', 'SO2Offset', 'SO2Prescaled',
        'SO2Scaled', 'SO2SerialNumber', 'SO2Slope', 'SO2Status', 'T1', 'T2', 'T3',
        'Temperature', 'TSP'
    )

    writer.writerow(fields)

    for file in files:
        logger.debug('Processing %s', file)
        with open(file) as reader:
            data = json.load(reader)
            header = data['Header']
            try:
                station_id = str(header['StationID'])
            except KeyError:
                station_id = str(header['StationId'])
            if not station_id.startswith('S-'):
                station_id = 'S-' + station_id
            header['station_id'] = station_id
            header['sensor_type'] = data.get('SensorType')
            ts = dateutil.parser.parse(header['Timestamp']).timestamp()
            header['ts'] = ts
            header['ts_text'] = epoch_to_text(ts)
            writer.writerow([header.get(f) for f in fields])


def aq_data_extractor(files, writer):

    logger.debug('In aq_data_extractor')
    fields = ('station_id', 'sensor_type', 'ts', 'ts_text', 'reading')
    writer.writerow(fields)

    for file in files:
        logger.debug('Processing %s', file)
        with open(file) as reader:
            data = json.load(reader)
            for ts, reading in data['Readings']:
                # Capitalisation of 'StationID' inconsistent
                try:
                    station_id = str(data['Header']['StationID'])
                except KeyError:
                    station_id = str(data['Header']['StationId'])
                if not station_id.startswith('S-'):
                    station_id = 'S-' + station_id
                row = [
                  station_id,
                  data['SensorType'],
                  ts,
                  epoch_to_text(ts/1000),
                  reading
                ]
                writer.writerow(row)


# Metadata extractors for each storage type. They receive a single filename
# in 'files' and a CSV writer object.


def aq_metadata_extractor(files, writer):

    logger.debug('In aq_metadata_extractor')
    fields = ('station_id', 'Name', 'Description', 'SensorTypes', 'Latitude', 'Longitude', 'date_from', 'date_to')
    writer.writerow(fields)

    assert len(files) == 1, 'Expecting exactly one file'
    logger.debug('Processing %s', files[0])
    with open(files[0]) as reader:
        for station in json.load(reader)['aq_list']:
            station['station_id'] = station['StationID']
            station['SensorTypes'] = '|'.join(station['SensorTypes'])
            writer.writerow([station.get(f) for f in fields])
