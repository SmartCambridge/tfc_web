import csv
import logging
from datetime import datetime

from django.core.management import BaseCommand
from django.db import transaction

from traffic.models import Trip


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Imports raw anpr data from the council"

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('filename', nargs=1, type=str, help="The ANPR raw file to be imported")

    @transaction.atomic
    def handle(self, **options):
        reader = csv.reader(open(options['filename'][0]))
        # ignore header
        next(reader)
        trips = []
        for row in reader:
            Trip.objects.create(entry_time=datetime.strptime(row[0], '%d/%m/%Y %H:%M'),
                                entry_lane=row[1],
                                entry_direction=row[5],
                                entry_camera_id=row[7],
                                entry_absolute_direction=row[8],
                                plate_encoded=row[2],
                                plate_country=row[3],
                                confidence=row[4],
                                exit_time=datetime.strptime(row[9], '%d/%m/%Y %H:%M'),
                                exit_lane=row[10],
                                exit_direction=row[11],
                                exit_camera_id=row[12],
                                exit_absolute_direction=row[13],
                                journey_time=row[15])
