"""tfc_web URL Configuration for Parking

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.8/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url
from realtime import views

urlpatterns = [
    url(r'^$', views.index, name='bus-home'),

    # Bus movements
    url(r'^map/$', views.bus_map, name='bus-map'),
    url(r'^busdata.json$', views.busdata_json, name='busdata-json'),

    # Bus Stops
    url(r'^stops/$', views.bus_stops_list, name='bus-stops-list'),
    url(r'^stop/(?P<bus_stop_id>\w+)/$', views.bus_stop, name='bus-stop'),
    url(r'^stop/$', views.bus_stop, name='bus-stop-template'),

    # Bus Lines
    url(r'^lines/$', views.bus_lines_list, name='bus-lines-list'),
    url(r'^line/(?P<bus_line_id>.+)/$', views.bus_line, name='bus-line'),

    # Bus Routes
    url(r'^route/map/(?P<bus_route_id>.+)/$', views.bus_route_map, name='bus-route-map'),
]
