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
from django.views.generic import TemplateView
from traffic import views


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name='traffic/home.html'), name='traffic_home'),
    url(r'^anpr/map/json/$', views.anpr_map, {'return_format': 'json'}, name='anpr_map_json'),
    url(r'^anpr/map/$', views.anpr_map, name='anpr_map'),
    url(r'^zones/map/$', views.zones_map, name='zones_map'),
    url(r'^zones/list/$', views.zones_list, name='zones_list'),
    url(r'^zone/map/(?P<zone_id>[-\w]+)/$', views.zone_map, name='zone_map'),
    url(r'^zone/plot/transit/(?P<zone_id>[-\w]+)/$', views.zone_transit_plot, name='zone_transit_plot')
]
