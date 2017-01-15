from django.contrib import admin
from django.contrib.admin import ModelAdmin
from realtime.models import BusLine, BusStop, BusOperator, BusRoute, BusJourney, BusJourneyPatternSection, \
    BusJourneyPattern


admin.site.register(BusRoute, ModelAdmin)
admin.site.register(BusOperator, ModelAdmin)
admin.site.register(BusLine, ModelAdmin)
admin.site.register(BusStop, ModelAdmin)
admin.site.register(BusJourneyPatternSection, ModelAdmin)
admin.site.register(BusJourneyPattern, ModelAdmin)
admin.site.register(BusJourney, ModelAdmin)
