"""tfc_web URL Configuration

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
from django.conf.urls import include, url
from django.contrib import admin
from realtime import views

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', views.home, name='home'),
    url(r'^busdata.json$', views.busdata_json, name='busdata-json'),


    # Bus Stops
    url(r'^bus/stops/$', views.bus_stops_list, name='bus-stops-list'),
    url(r'^bus/stop/(?P<bus_stop_id>\w+)/$', views.bus_stop, name='bus-stop'),

    # Zones
    url(r'^zones/$', views.zones_list, name='zones-list'),
    url(r'^zone/(?P<zone_id>\w+)/$', views.zone, name='zone')
]
