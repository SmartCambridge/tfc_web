import csv
from django.core.management.base import BaseCommand
from vix.models import Stop


class Command(BaseCommand):
    help = "Updates stops info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            Stop.objects.all().delete()

            for csv_row in csv_reader:
                stop = Stop()
                stop.id = csv_row['stop_id']
                stop.code = csv_row['stop_code']
                stop.name = csv_row['stop_name']
                stop.latitude = csv_row['stop_lat']
                stop.longitude = csv_row['stop_lon']
                stop.save()
