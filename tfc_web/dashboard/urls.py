from django.conf.urls import url
from dashboard import views


urlpatterns = [
    url(r'^design/', views.design, name='dashboard-design'),
    url(r'^layout/(?P<layout_id>\d+)/$', views.layout, name='layout'),
    url(r'^layout/(?P<layout_id>\d+)/config/$', views.layout_config, name='dashboard-layout-config'),
    url(r'^station_board$', views.station_board, name='station-board')
]
