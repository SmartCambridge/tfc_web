from django.contrib import admin
from django.contrib.admin import ModelAdmin
from transport.models import Line, Stop, Operator, Route, VehicleJourney, JourneyPatternSection, \
    JourneyPattern


admin.site.register(Route, ModelAdmin)
admin.site.register(Operator, ModelAdmin)
admin.site.register(Line, ModelAdmin)
admin.site.register(Stop, ModelAdmin)
admin.site.register(JourneyPatternSection, ModelAdmin)
admin.site.register(JourneyPattern, ModelAdmin)
admin.site.register(VehicleJourney, ModelAdmin)
