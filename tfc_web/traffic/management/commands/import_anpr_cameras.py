import csv
import logging
from datetime import datetime

from django.core.management import BaseCommand
from django.db import transaction

from traffic.models import Trip, ANPRCamera

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Imports anpr camera locations"

    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('filename', nargs=1, type=str, help="The ANPR camera file to be imported")

    @transaction.atomic
    def handle(self, **options):
        reader = csv.reader(open(options['filename'][0]))
        # ignore header
        next(reader)
        trips = []
        for row in reader:
            ANPRCamera.objects.create(
                id=row[0],
                units=row[1],
                description=row[2],
                lat=row[3],
                lng=row[4]
            )
