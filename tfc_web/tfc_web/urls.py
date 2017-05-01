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
from django.views.generic import TemplateView
from transport import views


urlpatterns = [
    # auth
    url(r'^accounts/', include('allauth.urls')),

    # Main pages
    url(r'^admin/', include(admin.site.urls)),
    url(r'^$', TemplateView.as_view(template_name="index.html"), name='home'),
    url(r'^about$', TemplateView.as_view(template_name="about.html"), name='about'),

    # Transport (Buses and others)
    url(r'^transport/', include('transport.urls')),

    # Parking
    url(r'^parking/', include('parking.urls')),

    # Traffic
    url(r'^traffic/', include('traffic.urls')),

    # Air Quality
    url(r'^aq/', include('aq.urls')),

    # Zones
    url(r'^zones/$', views.zones_list, name='zones-list'),
    url(r'^zone/(?P<zone_id>\w+)/$', views.zone, name='zone'),

    # Cambridge Sensor Network
    url(r'^csn/', include('csn.urls')),
]
