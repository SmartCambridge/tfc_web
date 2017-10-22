from django.contrib import admin
from django.contrib.admin import ModelAdmin
from django.contrib.gis.admin import OSMGeoAdmin
from transport.models import *


@admin.register(Stop)
class StopAdmin(OSMGeoAdmin):
    list_display = ('atco_code', 'common_name', 'locality_name')


admin.site.register(Route, ModelAdmin)
admin.site.register(Operator, ModelAdmin)
admin.site.register(Line, ModelAdmin)
admin.site.register(JourneyPatternTimingLink, ModelAdmin)
admin.site.register(JourneyPatternSection, ModelAdmin)
admin.site.register(JourneyPattern, ModelAdmin)
admin.site.register(VehicleJourney, ModelAdmin)


class TimetableAdmin(ModelAdmin):
    list_display = ('id', 'vehicle_journey', 'stop', 'time')
    search_fields = ['stop__atco_code', 'vehicle_journey__id']
admin.site.register(Timetable, TimetableAdmin)
