from django.conf.urls import url
from django.views.generic import TemplateView
from dashboard.views import dashboard
from dashboard.views.widgets import weather, station_board


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="dashboard/home.html"), name='dashboard-home'),
    url(r'^my/$', dashboard.my, name='dashboard-my'),
    url(r'^screen/new$', dashboard.new_screen, name='dashboard-new-screen'),
    url(r'^screens/', dashboard.screens, name='dashboard-list-screens'),
    url(r'^design/', dashboard.design, name='dashboard-design'),
    url(r'^layout/(?P<layout_id>\d+)/$', dashboard.layout, name='layout'),
    url(r'^layout/(?P<layout_id>\d+)/config/$', dashboard.layout_config, name='dashboard-layout-config'),
    url(r'^layout/(?P<layout_id>\d+)/deletewidget/$', dashboard.layout_delete_widget, name='dashboard-layout-delete-widget'),
    url(r'^weather$', weather.weather, name='dashboard-weather'),
    url(r'^station_board$', station_board.station_board, name='station-board')
]
