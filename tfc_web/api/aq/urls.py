from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^$', views.AQList.as_view()),
    url(r'^(?P<station_id>[^/]+)/$', views.AQConfig.as_view()),
    url(r'^history/(?P<station_id>[^/]+)/(?P<sensor_type>[^/]+)/(?P<month>\d{4}-\d{2})$', views.AQHistory.as_view()),
    

]
