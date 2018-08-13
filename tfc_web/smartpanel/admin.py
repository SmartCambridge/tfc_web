from django.contrib import admin
from django.contrib.admin import ModelAdmin
from smartpanel.models import Layout, Display, SmartPanelUser

admin.site.register(Layout, ModelAdmin)
admin.site.register(Display, ModelAdmin)
admin.site.register(SmartPanelUser, ModelAdmin)
