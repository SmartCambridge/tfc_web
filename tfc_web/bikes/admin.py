from django.contrib import admin
from django.contrib.admin import ModelAdmin
from django.contrib.gis.admin import OSMGeoAdmin

from bikes.models import Bike


@admin.register(Bike)
class BikeAdmin(OSMGeoAdmin):
    list_display = ('bike_id', 'company', 'gis_location', 'timestamp')
