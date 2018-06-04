from django.conf.urls import include
from django.conf.urls import url
from django.views.generic import TemplateView

from rest_framework.documentation import include_docs_urls

# Nasty hack to create a set of patterns to feed to
# include_docs_urls
docpatterns = [
    url(r'^/api/v1/parking/', include('api.parking.urls')),
    url(r'^/api/v1/zone/', include('api.zones.urls')),
    url(r'^/api/v1/aq/', include('api.aq.urls')),
    # Import transport views previously served under /transport/api/
    url(r'^/api/v1/transport/', include('transport.api.urls')),
]

urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="api/index.html"), name="api_home"),
    # url(r'', include('authmultitoken.endpoint_urls')),
    url(r'', include('authmultitoken.html_urls')),
    url(r'^docs/', include_docs_urls(title='SmartCambridge API', patterns=docpatterns)),
    url(r'^v1/parking/', include('api.parking.urls')),
    url(r'^v1/zone/', include('api.zones.urls')),
    url(r'^v1/aq/', include('api.aq.urls')),
    # Import transport views previously served under /transport/api/
    url(r'^v1/transport/', include('transport.api.urls')),
]
