from django.conf.urls import url
from . import views

urlpatterns = [
    url(r'^journeys/$', views.VehicleJourneyList.as_view()),
    url(r'^journey/(?P<pk>[^/]+)/$', views.VehicleJourneyRetrieve.as_view()),
    url(r'^stops/$', views.StopList.as_view()),
    url(r'^stop/(?P<pk>[^/]+)/$', views.StopRetrieve.as_view()),
    url(r'^sirivm_with_journey/', views.siriVM_to_journey, name='siriVM-to-journey'),
    url(r'^sirivm_add_journey/', views.siriVM_POST_to_journey, name='siriVM-POST-to-journey'),
    url(r'^journeys_by_time_and_stop/$', views.journeys_by_time_and_stop, name='journeys-by-time-and-stop'),
    url(r'^departure_to_journey/$', views.departure_to_journey, name='departure-to-journey')
]