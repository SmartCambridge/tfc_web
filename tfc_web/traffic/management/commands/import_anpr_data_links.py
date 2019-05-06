import logging
import pandas
from datetime import timedelta, datetime

from django.core.management import BaseCommand
from django.db import transaction

from traffic.models import TripChain


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Imports anpr data links between the cameras from the council"

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('filename', nargs=1, type=str, help="The ANPR data links file to be imported")

    @transaction.atomic
    def handle(self, **options):
        with pandas.ExcelFile(options['filename'][0]) as xls:
            list_of_sheets = pandas.read_excel(xls, None)
            del list_of_sheets['Front Cover']
            del list_of_sheets['QA & Issue Sheet']
            del list_of_sheets['Contents Page']
            del list_of_sheets['Location Plan']
            del list_of_sheets['Summary']
            del list_of_sheets['Trip Arrays']
            for sheet_name, df in list_of_sheets.items():
                for row in df.iterrows():
                    index, data = row
                    if index > 10:
                        TripChain.objects.create(
                            camera_id=sheet_name,
                            entry_time=data[1] if data[1].__class__ != str else datetime.strptime(data[1], '%d/%m/%Y %H:%M:%S'),
                            vehicle_class=data[2],
                            total_trip_time=timedelta(data[3]*60/86400),
                            chain_vector=data[4],
                            chain_vector_time=data[5])
