from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^$', views.ParkingList.as_view()),
    url(r'^(?P<parking_id>[^/]+)/$', views.ParkingConfig.as_view()),
    url(r'^latest/(?P<parking_id>[^/]+)$', views.ParkingLatest.as_view()),
    url(r'^previous/(?P<parking_id>[^/]+)$', views.ParkingPrevious.as_view()),
    url(r'^history/(?P<parking_id>[^/]+)$', views.ParkingHistory.as_view()),

]
