from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^$', views.ParkingList.as_view()),
    url(r'^(?P<parking_id>[^/]+)/latest/$', views.ParkingLatest.as_view()),
    url(r'^(?P<parking_id>[^/]+)/previous/$', views.ParkingPrevious.as_view()),
    url(r'^(?P<parking_id>[^/]+)/history/$', views.ParkingHistory.as_view()),
    url(r'^(?P<parking_id>[^/]+)/$', views.ParkingConfig.as_view()),

]
