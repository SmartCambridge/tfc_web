from django.contrib import admin
from django.contrib.admin import ModelAdmin
from django.utils.html import format_html

from csn.models import Sensor, Connection


def everynet_connection(obj):
    return format_html('<a href="https://ns.eu.everynet.io/connections/%s" target="_blank">link</a>' %
                       (str(obj.info['connection_id']))) if 'connection_id' in obj.info else ''


everynet_connection.short_description = 'everyet connection'


def everynet_filter(obj):
    return format_html('<a href="https://ns.eu.everynet.io/filters/%s" target="_blank">link</a>' %
                       (str(obj.info['filter_id']))) if 'filter_id' in obj.info else ''


everynet_filter.short_description = 'everyet filter'


class ConnectionAdmin(admin.ModelAdmin):
    list_display = ('id', everynet_connection, everynet_filter)


def everynet_sensor(obj):
    return format_html('<a href="https://ns.eu.everynet.io/devices/%s" target="_blank">link</a>' %
                       (str(obj.info['sensor_id']))) if 'sensor_id' in obj.info else ''


everynet_filter.short_description = 'everyet device'


class SensorAdmin(admin.ModelAdmin):
    list_display = ('id', everynet_sensor)


admin.site.register(Connection, ConnectionAdmin)
admin.site.register(Sensor, SensorAdmin)
