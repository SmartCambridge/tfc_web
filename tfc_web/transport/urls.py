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
from rest_framework.documentation import include_docs_urls
from transport.api import views as api_views
from transport import views


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="home.html"), name='bus-home'),

    # Areas
    url(r'^areas/$', views.areas, name='transport-areas'),
    url(r'^area/(?P<area_id>\d+)/$', views.area_home, name='transport-area-home'),

    # Bus movements
    url(r'^map/$', views.bus_map, name='bus-map'),
    url(r'^map2/$', views.bus_map_sirivm, name='bus-map-sirivm'),
    url(r'^busdata.json$', views.busdata_json, name='busdata-json'),

    # Bus Stops
    url(r'^stops/$', views.bus_stops_list, name='bus-stops-list'),
    url(r'^stops/area/(?P<area_id>\d+)/$', views.bus_stops_list, name='bus-stops-list-area'),
    url(r'^stop/(?P<bus_stop_id>\w+)/$', views.bus_stop, name='bus-stop'),
    url(r'^stop/$', views.bus_stop, name='bus-stop-template'),

    # Bus Lines
    url(r'^lines/$', views.bus_lines_list, name='bus-lines-list'),
    url(r'^lines/area/(?P<area_id>\d+)/$', views.bus_lines_list, name='bus-lines-list-area'),
    url(r'^line/(?P<bus_line_id>.+)/$', views.bus_line_timetable, name='bus-line'),
    url(r'^line/old/(?P<bus_line_id>.+)/$', views.bus_line, name='bus-line-old'),

    # Bus Routes
    url(r'^route/map/(?P<bus_route_id>.+)/$', views.bus_route_map, name='bus-route-map'),

    # Bus Timetable
    url(r'^route/timetable/map/bus/(?P<journey_id>.+)/$', views.bus_route_timetable_map, name='bus-route-timetable-map'),
    url(r'^route/timetable/map/(?P<journey_id>.+)/$', views.route_timetable_map, name='route-timetable-map'),
    url(r'^route/timetable/(?P<bus_route_id>.+)/$', views.bus_route_timetable, name='bus-route-timetable'),

    # New Bus Timetable
    url(r'^timetable/journey/(?P<vehicle_journey_id>.+)/$', views.vehicle_journey_real_time, name='vehicle-journey-real-time'),
    url(r'^timetable/(?P<pk>[^/]+)', views.ServiceDetailView.as_view(), name='bus-line-timetable'),

    # API
    url(r'api/docs/', include_docs_urls(title='SmartCambridge Transport API')),
    url(r'api/journeys/$', api_views.VehicleJourneyList.as_view()),
    url(r'api/journey/(?P<pk>[^/]+)/$', api_views.VehicleJourneyRetrieve.as_view()),
    url(r'api/sirivm_with_journey/', api_views.siriVM_to_journey, name='siriVM-to-journey'),
    url(r'api/sirivm_add_journey/', api_views.siriVM_POST_to_journey, name='siriVM-POST-to-journey'),
    url(r'api/journeys_by_time_and_stop/$', api_views.journeys_by_time_and_stop, name='journeys-by-time-and-stop'),
    url(r'api/departure_to_journey/$', api_views.departure_to_journey, name='departure-to-journey')
]
