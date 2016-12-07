import csv
from django.core.management.base import BaseCommand
from vix.models import Route


class Command(BaseCommand):
    help = "Updates routes info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            Route.objects.all().delete()

            for csv_row in csv_reader:
                route = Route()
                route.id = csv_row['route_id']
                route.agency_id = csv_row['agency_id']
                route.short_name = csv_row['route_short_name']
                route.long_name = csv_row['route_long_name']
                route.type = csv_row['route_type']
                route.save()
