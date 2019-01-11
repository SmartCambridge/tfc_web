from django.conf.urls import url
from smartcambridge import views


urlpatterns = [
    url(r'^tcs/accept$', views.accept_tcs, name='smartcambridge-accept-tcs'),
    url(r'^tcs/$', views.tcs, name='smartcambridge-tcs'),

    url(r'^logger/(?P<module_id>.+)/(?P<component_id>.+)/(?P<component_ref>.+)/$',
        views.smartcambridge_logger,
        name='smartcambridge-logger')
]

