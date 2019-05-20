from django.conf.urls import url
from . import views


urlpatterns = [
    url(r'^$', views.AppList.as_view()),
    url(r'^(?P<app_id>[^/]+)/$', views.AppConfig.as_view()),
    url(r'^history/(?P<app_id>[^/]+)/$', views.AppHistory.as_view()),
    url(r'^latest/(?P<app_id>[^/]+)/(?P<dev_eui>[^/]+)/$', views.AppLatest.as_view()),
    url(r'^previous/(?P<app_id>[^/]+)/(?P<dev_eui>[^/]+)/$', views.AppPrevious.as_view()),

]
