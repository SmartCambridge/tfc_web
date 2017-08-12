from django.contrib import admin
from django.contrib.admin import ModelAdmin
from csn.models import LWApplication, LWDevice, Destination, Sensor, SensorData


admin.site.register(Destination, ModelAdmin)
admin.site.register(Sensor, ModelAdmin)
admin.site.register(SensorData, ModelAdmin)
admin.site.register(LWDevice, ModelAdmin)
admin.site.register(LWApplication, ModelAdmin)
