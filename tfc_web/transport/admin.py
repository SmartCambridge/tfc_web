from django.contrib import admin
from django.contrib.admin import ModelAdmin
from django.contrib.gis.admin import OSMGeoAdmin
from transport.models import *

class StopAdmin(OSMGeoAdmin):
    model = Stop
    list_display = ["atco_code", "common_name"]
    search_fields = ["atco_code", "common_name"]

class JourneyPatternTimingLinkAdmin(admin.ModelAdmin):
    model = JourneyPatternTimingLink
    raw_id_fields = ["to_stop", "from_stop"]

class LineAdmin(admin.ModelAdmin):
    model = Line
    list_display = ["line_name", "description"]
    search_fields = ["line_name"]

class ServiceAdmin(admin.ModelAdmin):
    model = Service
    list_display = ["service_code", "description"]
    search_fields = ["service_code"]

class VehicleJourneyAdmin(admin.ModelAdmin):
    model = VehicleJourney
    list_display = ["vehicle_journey_code", "service"]
    search_fields = ["vehicle_journey_code"]

admin.site.register(Operator, ModelAdmin)
admin.site.register(Line, LineAdmin)
admin.site.register(Stop, StopAdmin)
admin.site.register(Service, ServiceAdmin)
admin.site.register(JourneyPattern, ModelAdmin)
admin.site.register(JourneyPatternTimingLink, JourneyPatternTimingLinkAdmin)
admin.site.register(VehicleJourney, VehicleJourneyAdmin)
admin.site.register(TransXChange, ModelAdmin)
