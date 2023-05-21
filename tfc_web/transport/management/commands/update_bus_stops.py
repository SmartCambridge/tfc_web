import csv
import zipfile
import logging
from pyproj import Transformer, CRS
from io import BytesIO, TextIOWrapper
from urllib.request import urlopen
from django.core.management.base import BaseCommand
from django.utils.timezone import now
from transport.models import Stop


logger = logging.getLogger(__name__)


def convert_northing_easting_to_lat_lon(easting, northing, in_proj_epsg=27700, out_proj_epsg=4326):
    in_proj = CRS(f"EPSG:{in_proj_epsg}")
    out_proj = CRS(f"EPSG:{out_proj_epsg}")
    transformer = Transformer.from_crs(in_proj, out_proj)
    lat, lon = transformer.transform(easting, northing)
    return lat, lon


class Command(BaseCommand):
    help = "Updates bus stops from DFT website"

    def handle(self, **options):
        """Update Bus Stops data from the DFT website"""
        stops_csv_file = urlopen(
            'https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv').read()
        csv_reader = csv.DictReader(TextIOWrapper(BytesIO(stops_csv_file), encoding='cp1252'))
        csv_rows = []
        title = csv_reader.fieldnames
        for row in csv_reader:
            csv_rows.extend([{title[i]: row[title[i]] for i in range(len(title))}])

        for element in csv_rows:
            lat = element['Latitude'].strip()
            long = element['Longitude'].strip()

            if lat == '' and long == '':
                easting = element['Easting'].strip()
                northing = element['Northing'].strip()
                lat, long = convert_northing_easting_to_lat_lon(easting, northing)
            
            Stop.objects.update_or_create(
                atco_code=element['ATCOCode'],
                defaults={
                    'naptan_code': None if element['NaptanCode'].strip() == '' else element['NaptanCode'].strip(),
                    'common_name': element['CommonName'].strip(),
                    'indicator': element['Indicator'].strip(),
                    'locality_name': element['LocalityName'].strip(),
                    'longitude': long,
                    'latitude': lat,
                    'data': element,
                    'last_modified': now()
                },
            )
