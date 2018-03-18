from django.conf.urls import url
from django.views.generic import TemplateView
from smartpanel.views import smartpanel
from smartpanel.views.widgets import weather, station_board


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="smartpanel/home.html"), name='smartpanel-home'),
    url(r'^my/$', smartpanel.my, name='smartpanel-my'),
    url(r'^list/$', smartpanel.all, name='smartpanel-all'),
    url(r'^display/new$', smartpanel.new_display, name='smartpanel-new-display'),
    url(r'^display/(?P<display_id>\d+)/edit', smartpanel.edit_display, name='smartpanel-edit-display'),
    url(r'^display/(?P<display_id>\d+)/delete', smartpanel.delete_display, name='smartpanel-delete-display'),
    url(r'^displays/', smartpanel.displays, name='smartpanel-list-displays'),
    url(r'^my-displays/', smartpanel.my_displays, name='smartpanel-list-my-displays'),
    url(r'^design/', smartpanel.design, name='smartpanel-design'),
    url(r'^layout/(?P<layout_id>\d+)/$', smartpanel.layout, name='smartpanel-layout'),
    url(r'^layout/(?P<layout_id>\d+)/config/$', smartpanel.layout_config, name='smartpanel-layout-config2'),
    url(r'^layout/(?P<layout_id>\d+)/config/overlay/$', smartpanel.layout_config2, name='smartpanel-layout-config'),
    url(r'^layout/(?P<layout_id>\d+)/delete/$', smartpanel.layout_delete, name='smartpanel-layout-delete'),
    url(r'^layout/(?P<layout_id>\d+)/deletewidget/$', smartpanel.layout_delete_widget, name='smartpanel-layout-delete-widget'),
    url(r'^weather$', weather.weather, name='smartpanel-weather'),
    url(r'^station_board$', station_board.station_board, name='station-board'),
    url(r'^info/$', TemplateView.as_view(template_name="smartpanel/info.html"), name='smartpanel-info')
]
