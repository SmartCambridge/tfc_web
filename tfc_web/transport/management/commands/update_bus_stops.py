from django.core.management.base import BaseCommand
from transport.crontasks import update_bus_stops_from_api


class Command(BaseCommand):
    help = "Updates bus stops from DFT website"

    def handle_noargs(self, **options):
        update_bus_stops_from_api()
