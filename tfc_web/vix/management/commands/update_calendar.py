import csv
from datetime import datetime

from django.core.management.base import BaseCommand
from vix.models import Calendar


class Command(BaseCommand):
    help = "Updates calendar info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            Calendar.objects.all().delete()

            for csv_row in csv_reader:
                calendar = Calendar()
                calendar.service_id = csv_row['service_id']
                calendar.monday = bool(int(csv_row['monday']))
                calendar.tuesday = bool(int(csv_row['tuesday']))
                calendar.wednesday = bool(int(csv_row['wednesday']))
                calendar.thursday = bool(int(csv_row['thursday']))
                calendar.friday = bool(int(csv_row['friday']))
                calendar.saturday = bool(int(csv_row['saturday']))
                calendar.sunday = bool(int(csv_row['sunday']))
                calendar.start_date = datetime.strptime(csv_row['start_date'], '%Y%m%d')
                calendar.end_date = datetime.strptime(csv_row['end_date'], '%Y%m%d')
                calendar.save()
