from django.contrib import admin
from django.contrib.admin import ModelAdmin
from csn.models import Destination, Sensor, SensorData


admin.site.register(Destination, ModelAdmin)
admin.site.register(Sensor, ModelAdmin)
admin.site.register(SensorData, ModelAdmin)
