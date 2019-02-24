from django.contrib import admin
from django.contrib.admin import ModelAdmin
from csn.models import Sensor, Connection

admin.site.register(Connection, ModelAdmin)
admin.site.register(Sensor, ModelAdmin)
