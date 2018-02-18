import csv
import zipfile
import logging
from io import BytesIO, TextIOWrapper
from urllib.request import urlopen
from django.db import transaction
from django.core.management.base import BaseCommand
from transport.models import Stop


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Updates bus stops from DFT website"

    @transaction.atomic
    def handle(self, **options):
        """Update Bus Stops data from the DFT website"""
        stops_csv_file = zipfile.ZipFile(BytesIO(urlopen(
            'http://naptan.app.dft.gov.uk/DataRequest/Naptan.ashx?format=csv').read())).read(
            'Stops.csv')
        csv_reader = csv.DictReader(TextIOWrapper(BytesIO(stops_csv_file), encoding='cp1252'))
        csv_rows = []
        title = csv_reader.fieldnames
        for row in csv_reader:
            csv_rows.extend([{title[i]: row[title[i]] for i in range(len(title))}])

        stop_objects = []
        for element in csv_rows:
            stop_objects.append(
                Stop(atco_code=element['ATCOCode'],
                     naptan_code=element['NaptanCode'],
                     common_name=element['CommonName'],
                     indicator=element['Indicator'],
                     locality_name=element['LocalityName'],
                     longitude=element['Longitude'],
                     latitude=element['Latitude'],
                     data=element))
        if stop_objects:
            Stop.objects.all().delete()
            Stop.objects.bulk_create(stop_objects)
