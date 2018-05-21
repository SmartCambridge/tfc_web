from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^$', views.ZoneList.as_view()),
    url(r'^(?P<zone_id>[^/]+)/history/$', views.ZoneHistory.as_view()),
    url(r'^(?P<zone_id>[^/]+)/$', views.ZoneConfig.as_view()),
]
