from django.contrib import admin
from django.contrib.admin import ModelAdmin

from traffic.models import Trip, TripChain, ANPRCamera


admin.site.register(ANPRCamera, ModelAdmin)
admin.site.register(Trip, ModelAdmin)
admin.site.register(TripChain, ModelAdmin)
