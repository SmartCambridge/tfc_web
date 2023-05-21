from django.conf.urls import url
from . import views

urlpatterns = [
    url(r'^journeys/$', views.VehicleJourneyList.as_view()),
    url(r'^journey/(?P<pk>[^/]+)/$', views.VehicleJourneyRetrieve.as_view()),
    url(r'^stops/$', views.StopList.as_view(), name='stops-api'),
    url(r'^stop/(?P<pk>[^/]+)/$', views.StopRetrieve.as_view()),
    url(r'^journeys_by_time_and_stop/$', views.journeys_by_time_and_stop, name='journeys-by-time-and-stop'),
]
