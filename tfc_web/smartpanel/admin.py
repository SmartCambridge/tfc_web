from django.contrib import admin
from django.contrib.admin import ModelAdmin
from smartpanel.models import Layout, Screen


admin.site.register(Layout, ModelAdmin)
admin.site.register(Screen, ModelAdmin)
