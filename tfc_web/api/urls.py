from django.conf.urls import include
from django.conf.urls import url
from django.views.generic import TemplateView

from rest_framework.documentation import include_docs_urls

urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name="api/index.html")),
    # url(r'', include('authmultitoken.endpoint_urls')),
    url(r'', include('authmultitoken.html_urls')),
    url(r'^docs/', include_docs_urls(title='TFC API')),
    url(r'^v1/parking/', include('api.parking.urls')),
    url(r'^v1/zone/', include('api.zones.urls')),
    url(r'^v1/aq/', include('api.aq.urls')),
]
