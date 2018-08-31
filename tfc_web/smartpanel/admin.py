from django.contrib import admin
from django.contrib.admin import ModelAdmin
from smartpanel.models import Layout, Display

admin.site.register(Layout, ModelAdmin)
admin.site.register(Display, ModelAdmin)

