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
from django.conf.urls import url, include
from django.views.generic import TemplateView, RedirectView
from rest_framework.documentation import include_docs_urls
from transport.api import views as api_views
from transport import views


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="home.html"), name='bus-home'),

    # Bus movements
    url(r'^map/$', views.map_real_time, name='bus-map'),

    # Bus Stops
    url(r'^stops/$', views.bus_stops_list, name='bus-stops-list'),
    url(r'^stop/(?P<bus_stop_id>\w+)/$', views.bus_stop, name='bus-stop'),
    url(r'^stop/$', views.bus_stop, name='bus-stop-template'),

    # Bus Lines
    url(r'^lines/$', views.bus_lines_list, name='bus-lines-list'),

    # Bus Routes
    url(r'^route/map/(?P<bus_route_id>.+)/$', views.bus_route_map, name='bus-route-map'),

    # Bus Timetable
    url(r'^route/timetable/map/bus/(?P<journey_id>.+)/$', views.bus_route_timetable_map, name='bus-route-timetable-map'),
    url(r'^route/timetable/map/(?P<journey_id>.+)/$', views.route_timetable_map, name='route-timetable-map'),
    url(r'^route/timetable/(?P<bus_route_id>.+)/$', views.bus_route_timetable, name='bus-route-timetable'),

    # New Bus Timetable
    url(r'^timetable/journey/(?P<vehicle_journey_id>.+)/$', views.vehicle_journey_real_time, name='vehicle-journey-real-time'),
    url(r'^timetable/(?P<slug>[^/]+)', views.ServiceDetailView.as_view(), name='bus-line-timetable'),

    # API - legacy support
    url(r'^api/docs/', RedirectView.as_view(pattern_name='api-docs:docs-index', permanent=True)),
    url(r'^api/', include('transport.api.urls'),),

    # Bus Analysis
    url(r'^rtroute/$', views.rtroute, name='rtroute')

]
