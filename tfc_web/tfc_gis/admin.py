from django.contrib import admin
from tfc_gis.models import Area


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('name', )
