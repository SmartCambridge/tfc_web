from django.contrib import admin
from django.contrib.admin import ModelAdmin
from smartcambridge.models import SmartCambridgeUser


admin.site.register(SmartCambridgeUser, ModelAdmin)
