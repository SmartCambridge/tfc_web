import csv
import zipfile
from datetime import datetime
from django.utils.timezone import pytz, now
from io import BytesIO, TextIOWrapper
from urllib.request import urlopen
from transport.models import Stop


def update_bus_stops_from_api():
    """Update Bus Stops data from the DFT website"""
    stops_csv_file = zipfile.ZipFile(BytesIO(urlopen(
        'http://naptan.app.dft.gov.uk/DataRequest/Naptan.ashx?format=csv').read())).read('Stops.csv')
    csv_reader = csv.DictReader(TextIOWrapper(BytesIO(stops_csv_file), encoding='cp1252'))

    # Emtpy all table content to put the new data
    Stop.objects.all().delete()

    for csv_row in csv_reader:
        bus_stop = Stop()
        bus_stop.atco_code = csv_row['ATCOCode']
        bus_stop.naptan_code = csv_row['NaptanCode']
        bus_stop.plate_code = csv_row['PlateCode']
        bus_stop.cleardown_code = csv_row['CleardownCode']
        bus_stop.common_name = csv_row['CommonName']
        bus_stop.common_name_lang = csv_row['CommonNameLang']
        bus_stop.short_common_name = csv_row['ShortCommonName']
        bus_stop.short_common_name_lang = csv_row['ShortCommonNameLang']
        bus_stop.landmark = csv_row['Landmark']
        bus_stop.landmark_lang = csv_row['LandmarkLang']
        bus_stop.street = csv_row['Street']
        bus_stop.street_lang = csv_row['StreetLang']
        bus_stop.crossing = csv_row['Crossing']
        bus_stop.crossing_lang = csv_row['CrossingLang']
        bus_stop.indicator = csv_row['Indicator']
        bus_stop.indicator_lang = csv_row['IndicatorLang']
        bus_stop.bearing = csv_row['Bearing']
        bus_stop.nptg_locality_code = csv_row['NptgLocalityCode']
        bus_stop.locality_name = csv_row['LocalityName']
        bus_stop.parent_locality_name = csv_row['ParentLocalityName']
        bus_stop.grand_parent_locality_name = csv_row['GrandParentLocalityName']
        bus_stop.town = csv_row['Town']
        bus_stop.town_lang = csv_row['TownLang']
        bus_stop.suburb = csv_row['Suburb']
        bus_stop.suburb_lang = csv_row['SuburbLang']
        bus_stop.locality_centre = False if csv_row['LocalityCentre'] == '' else csv_row['LocalityCentre']
        bus_stop.grid_type = csv_row['GridType']
        bus_stop.easting = csv_row['Easting']
        bus_stop.northing = csv_row['Northing']
        bus_stop.longitude = csv_row['Longitude']
        bus_stop.latitude = csv_row['Latitude']
        bus_stop.stop_type = csv_row['StopType']
        bus_stop.bus_stop_type = csv_row['BusStopType']
        bus_stop.timing_status = csv_row['TimingStatus']
        bus_stop.default_wait_time = int(csv_row['DefaultWaitTime']) if csv_row['DefaultWaitTime'] else None
        bus_stop.notes = csv_row['Notes']
        bus_stop.notes_lang = csv_row['NotesLang']
        bus_stop.administrative_area_code = csv_row['AdministrativeAreaCode']
        bus_stop.creation_datetime = now if '' else datetime.strptime(
            csv_row['CreationDateTime'], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=pytz.utc)
        bus_stop.modification_datetime = None if '' else datetime.strptime(
            csv_row['ModificationDateTime'], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=pytz.utc)
        bus_stop.revision_number = csv_row['RevisionNumber']
        bus_stop.modification = csv_row['Modification']
        bus_stop.status = csv_row['Status']
        bus_stop.save()
