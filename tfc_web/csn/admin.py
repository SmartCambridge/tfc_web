from django.contrib import admin
from django.contrib.admin import ModelAdmin
from csn.models import LWApplication, LWDevice


admin.site.register(LWDevice, ModelAdmin)
admin.site.register(LWApplication, ModelAdmin)
