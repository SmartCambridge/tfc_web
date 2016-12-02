import csv
from django.core.management.base import BaseCommand
from vix.models import Trip


class Command(BaseCommand):
    help = "Updates trips info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            Trip.objects.all().delete()

            for csv_row in csv_reader:
                trip = Trip()
                trip.id = csv_row['trip_id']
                trip.route_id = csv_row['route_id']
                trip.service_id = csv_row['service_id']
                trip.headsign = csv_row['trip_headsign']
                trip.short_name = csv_row['trip_short_name']
                trip.direction = csv_row['direction_id']
                trip.save()
