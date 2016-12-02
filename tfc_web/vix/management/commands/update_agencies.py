import csv
from django.core.management.base import BaseCommand

from vix.models import Agency


class Command(BaseCommand):
    help = "Updates agency info from VIX csv file"
    def add_arguments(self, parser):
        parser.add_argument('csv_file')

    def handle(self, *args, **options):
        with open(options['csv_file']) as csvfile:
            csv_reader = csv.DictReader(csvfile)

            # Emtpy all table content to put the new data
            Agency.objects.all().delete()

            for csv_row in csv_reader:
                agency = Agency()
                agency.id = csv_row['agency_id']
                agency.name = csv_row['agency_name']
                agency.url = csv_row['agency_url']
                agency.save()
