from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^zone/$', views.ZoneList.as_view()),
    url(r'^zone/(?P<zone_id>[^/]+)/$', views.ZoneConfig.as_view()),
    url(r'^zone/history/(?P<zone_id>[^/]+)/$', views.ZoneHistory.as_view()),
    url(r'^btjourney/link/$', views.BTJourneyLinkList.as_view()),
    url(r'^btjourney/route/$', views.BTJourneyRouteList.as_view()),
    url(r'^btjourney/link_or_route/(?P<id>[^/]+)/$', views.BTJourneyLinkOrRouteConfig.as_view()),
    url(r'^btjourney/site/$', views.BTJourneySiteList.as_view()),
    url(r'^btjourney/site/(?P<site_id>[^/]+)/$', views.BTJourneySiteConfig.as_view()),
    url(r'^btjourney/history/(?P<id>[^/]+)/$', views.BTJourneyLinkHistory.as_view()),
    url(r'^btjourney/latest/$', views.BTJourneyLinkLatestList.as_view()),
    url(r'^btjourney/latest/(?P<id>[^/]+)/$', views.BTJourneyLinkLatest.as_view()),
    url(r'^anpr/camera/$', views.ANPRCameraList.as_view()),
    url(r'^anpr/trip/$', views.ANPRTripList.as_view()),
]
