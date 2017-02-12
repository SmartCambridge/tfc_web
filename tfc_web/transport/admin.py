from django.contrib import admin
from django.contrib.admin import ModelAdmin
from transport.models import Line, Stop, Operator, Route, VehicleJourney, JourneyPatternSection, \
    JourneyPattern


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ('atco_code', 'common_name', 'locality_name')


admin.site.register(Route, ModelAdmin)
admin.site.register(Operator, ModelAdmin)
admin.site.register(Line, ModelAdmin)
admin.site.register(JourneyPatternSection, ModelAdmin)
admin.site.register(JourneyPattern, ModelAdmin)
admin.site.register(VehicleJourney, ModelAdmin)
