import csv
from django.core.management.base import BaseCommand
from vix.models import StopTime


class Command(BaseCommand):
    help = "Updates stop times info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            StopTime.objects.all().delete()

            for csv_row in csv_reader:
                stop_time = StopTime()
                stop_time.trip_id = csv_row['trip_id']
                if csv_row['arrival_time'][:2] == '24':
                    csv_row['arrival_time'] = '00'+csv_row['arrival_time'][2:]
                stop_time.arrival_time = csv_row['arrival_time']
                if csv_row['departure_time'][:2] == '24':
                    csv_row['departure_time'] = '00'+csv_row['departure_time'][2:]
                stop_time.departure_time = csv_row['departure_time']
                stop_time.stop_id = csv_row['stop_id']
                stop_time.sequence = csv_row['stop_sequence']
                stop_time.stop_headsign = csv_row['stop_headsign']
                stop_time.save()
