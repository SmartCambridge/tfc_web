from django.contrib.admin import ModelAdmin
from smartpanel.models import Layout, Display, Pocket
from django.utils.safestring import mark_safe
from django.urls import reverse
from django.contrib.gis import admin as admin


class DisplayAdmin(admin.OSMGeoAdmin):
    list_display = ('slug', 'name', 'layout_link', 'owner_link')
    search_fields = ('slug', 'name', 'owner__username')

    def owner_link(self, display):
        url = reverse("admin:auth_user_change", args=[display.owner.id])
        link = '<a href="%s">%s</a>' % (url, display.owner.username)
        return mark_safe(link)
    owner_link.short_description = 'Owner'
    owner_link.admin_order_field = 'owner__username'


    def layout_link(self, display):
        url = reverse("admin:smartpanel_layout_change", args=[display.layout.id])
        link = '<a href="%s">%s</a>' % (url, display.layout)
        return mark_safe(link)
    layout_link.short_description = 'Layout'
    layout_link.admin_order_field = 'layout__name'

class LayoutAdmin(admin.OSMGeoAdmin):
    list_display = ('slug', 'name', 'owner_link')
    search_fields = ('slug', 'name', 'owner__username')

    def owner_link(self, display):
        url = reverse("admin:auth_user_change", args=[display.owner.id])
        link = '<a href="%s">%s</a>' % (url, display.owner.username)
        return mark_safe(link)
    owner_link.short_description = 'Owner'
    owner_link.admin_order_field = 'owner__username'


admin.site.register(Layout, LayoutAdmin)
admin.site.register(Display, DisplayAdmin)
admin.site.register(Pocket, ModelAdmin)
