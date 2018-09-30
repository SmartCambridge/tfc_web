import json
import logging
import time

import pyofo
import requests
from django.conf import settings
from django.contrib.gis import geos
from django.core.management.base import BaseCommand
from geopy import Point
from geopy.distance import vincenty

from bikes.models import Bike

logger = logging.getLogger(__name__)


# We assume that Cambridge area is the square between 52.237781, 0.074390 and 52.160767, 0.188302
# The radius of ofo bikes radar seems to be 360 meters (experimentally tested)
# The radius of mobike bikes radar seems to be 500 meters (return from the API)
# We'll use 350 meters as radius of the radar. We use Pythagoras to calculate the square inside the circle.
# We have a diameter of 350x2 = 700 meters. 2 x SquareSide^2 = CircleDiameter^2
# 2 x SquareSide^2 = 490,000; SquareSide^2 = 245,000; SquareSide = 500 meters (approx)


CAMBRIDGE_COORDINATES = [
    (52.237781, 0.074390),
    (52.237781, 0.188302),
    (52.160767, 0.074390),
    (52.160767, 0.188302)
]


class Command(BaseCommand):
    help = "Scan for shared bikes in Cambridge. Currently ofo and mobike"

    def retrive_bikes(self, lat, lng):
        bike_objects = []

        # Retrieve ofo bikes
        pyofo.set_token(settings.OFO_TOKEN)
        ofo = pyofo.Ofo()
        ro = ofo.nearby_ofo_car(lat=lat, lng=lng)
        ofo_data = json.loads(ro.text)
        ofo_bikes = ofo_data.get('values', {}).get('cars', [])
        for ofo_bike in ofo_bikes:
            bike_objects.append(Bike(bike_id=ofo_bike.get("carno"), company="ofo", lng=ofo_bike.get("lng"),
                                     lat=ofo_bike.get("lat"), data=ofo_bike,
                                     gis_location=geos.Point(ofo_bike.get("lng"), ofo_bike.get("lat"))))

        # Retrieve mobike bikes
        rm = requests.post('https://mwx.mobike.com/mobike-api/rent/nearbyBikesInfo.do',
                           data='latitude=%s&longitude=%s' % (lat, lng),
                           headers={
                               'content-type': 'application/x-www-form-urlencoded',
                               'user-agent': 'Mozilla/5.0 (Linux; Android 7.0; SM-G892A Build/NRD90M; wv) '
                                             'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/60.0.3112.107 '
                                             'Mobile Safari/537.36'
                           })
        mobike_data = json.loads(rm.text)
        mobike_bikes = mobike_data.get('object', [])
        for mobike_bike in mobike_bikes:
            bike_objects.append(Bike(bike_id=mobike_bike.get("bikeIds"), company="mobike", lng=mobike_bike.get("distX"),
                                     lat=mobike_bike.get("distY"), data=mobike_bike,
                                     gis_location=geos.Point(mobike_bike.get("distX"), mobike_bike.get("distY"))))

        if bike_objects:
            Bike.objects.bulk_create(bike_objects)

    def handle(self, **options):
        """
        Retrieve shared bikes from around the area from ofo and mobike
        """
        while True:
            lat = CAMBRIDGE_COORDINATES[0][0]
            lng = CAMBRIDGE_COORDINATES[0][1]
            while lat > CAMBRIDGE_COORDINATES[2][0]:
                lat_p = lat
                lng_p = lng
                while lng < CAMBRIDGE_COORDINATES[1][1]:
                    self.retrive_bikes(lat, lng)
                    time.sleep(5)
                    lat, lng, z = vincenty(meters=500).destination(Point(lat, lng), 90) # Go east
                lat, lng, z = vincenty(meters=500).destination(Point(lat_p, lng_p), 180)  # Go south
            time.sleep(600)
