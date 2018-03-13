from django.conf.urls import url
from django.views.generic import TemplateView
from smartpanel.views import smartpanel
from smartpanel.views.widgets import weather, station_board


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="smartpanel/home.html"), name='smartpanel-home'),
    url(r'^my/$', smartpanel.my, name='smartpanel-my'),
    url(r'^screen/new$', smartpanel.new_screen, name='smartpanel-new-screen'),
    url(r'^screens/', smartpanel.screens, name='smartpanel-list-screens'),
    url(r'^design/', smartpanel.design, name='smartpanel-design'),
    url(r'^layout/(?P<layout_id>\d+)/$', smartpanel.layout, name='layout'),
    url(r'^layout/(?P<layout_id>\d+)/config/$', smartpanel.layout_config, name='smartpanel-layout-config'),
    url(r'^layout/(?P<layout_id>\d+)/config/overlay/$', smartpanel.layout_config2, name='smartpanel-layout-config2'),
    url(r'^layout/(?P<layout_id>\d+)/deletewidget/$', smartpanel.layout_delete_widget, name='smartpanel-layout-delete-widget'),
    url(r'^weather$', weather.weather, name='smartpanel-weather'),
    url(r'^station_board$', station_board.station_board, name='station-board')
]
