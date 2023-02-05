import csv
import zipfile
import logging
from io import BytesIO, TextIOWrapper
from urllib.request import urlopen
from django.db import transaction
from django.core.management.base import BaseCommand
from django.utils.timezone import now

from transport.models import Stop


logger = logging.getLogger(__name__)


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
            if element['Longitude'] != '' and element['Latitude'] != '':
                Stop.objects.update_or_create(
                    atco_code=element['ATCOCode'],
                    defaults={
                        'naptan_code': element['NaptanCode'],
                        'common_name': element['CommonName'],
                        'indicator': element['Indicator'],
                        'locality_name': element['LocalityName'],
                        'longitude': element['Longitude'],
                        'latitude': element['Latitude'],
                        'data': element,
                        'last_modified': now()
                    },
                )
