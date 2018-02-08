from django.conf.urls import url
from dashboard.views import dashboard
from dashboard.views.widgets import weather, station_board


urlpatterns = [
    url(r'^design/', dashboard.design, name='dashboard-design'),
    url(r'^layout/(?P<layout_id>\d+)/$', dashboard.layout, name='layout'),
    url(r'^layout/(?P<layout_id>\d+)/config/$', dashboard.layout_config, name='dashboard-layout-config'),
    url(r'^weather$', weather.weather, name='dashboard-weather'),
    url(r'^station_board$', station_board.station_board, name='station-board')
]
