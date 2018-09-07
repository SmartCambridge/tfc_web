from django.contrib import admin
from django.contrib.admin import ModelAdmin
from smartcambridge.models import SmartCambridgeUser

class SmartCambridgeUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'accepted_tcs')
    ordering = ('user',)

admin.site.register(SmartCambridgeUser, SmartCambridgeUserAdmin)
