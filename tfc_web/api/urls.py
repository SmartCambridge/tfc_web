from django.conf.urls import include
from django.conf.urls import url
from django.views.generic import TemplateView

from rest_framework.documentation import include_docs_urls

from smartcambridge.decorator import smartcambridge_valid_user


# Nasty hack to create a set of patterns to feed to
# include_docs_urls
docpatterns = [
    url(r'^/api/v1/parking/', include('parking.api.urls')),
    url(r'^/api/v1/zone/', include('traffic.api.urls')),
    url(r'^/api/v1/aq/', include('aq.api.urls')),
    # Import transport views previously served under /transport/api/
    url(r'^/api/v1/transport/', include('transport.api.urls')),
]


urlpatterns = [
    url(r'^$', smartcambridge_valid_user(TemplateView.as_view(template_name="api/index.html")), name="api_home"),
    # url(r'', include('authmultitoken.endpoint_urls')),
    url(r'', include('authmultitoken.html_urls')),
    url(r'^auth/', include('api.auth_urls')),
    url(r'^docs/', include_docs_urls(title='SmartCambridge API', patterns=docpatterns)),
    url(r'^v1/parking/', include('parking.api.urls')),
    url(r'^v1/zone/', include('traffic.api.urls')),
    url(r'^v1/aq/', include('aq.api.urls')),
    url(r'^v1/transport/', include('transport.api.urls')),
]
