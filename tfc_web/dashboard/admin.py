from django.contrib import admin
from django.contrib.admin import ModelAdmin
from dashboard.models import Layout, Screen


admin.site.register(Layout, ModelAdmin)
admin.site.register(Screen, ModelAdmin)
