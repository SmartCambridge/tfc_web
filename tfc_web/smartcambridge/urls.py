from django.conf.urls import url
from smartcambridge import views


urlpatterns = [
    url(r'^tcs/accept$', views.accept_tcs, name='smartcambridge-accept-tcs'),
    url(r'^tcs/$', views.tcs, name='smartcambridge-tcs'),
]
