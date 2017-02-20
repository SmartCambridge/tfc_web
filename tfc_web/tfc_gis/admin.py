from django.contrib import admin
from django.contrib.gis.admin import OSMGeoAdmin
from tfc_gis.models import Area


@admin.register(Area)
class AreaAdmin(OSMGeoAdmin):
    list_display = ('name', )
