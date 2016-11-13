from django.core.management.base import NoArgsCommand
from realtime.crontasks import update_bus_stops_from_api


class Command(NoArgsCommand):
    help = "Updates bus stops from DFT website"

    def handle_noargs(self, **options):
        update_bus_stops_from_api()
