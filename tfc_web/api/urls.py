from django.conf.urls import url
from rest_framework.documentation import include_docs_urls
from django.conf.urls import include

urlpatterns = [
    # url(r'', include('authmultitoken.endpoint_urls')),
    url(r'', include('authmultitoken.html_urls')),
    url(r'^docs/', include_docs_urls(title='TFC API')),
    url(r'^parking/', include('api.parking.urls')),
    url(r'^zones/', include('api.zones.urls')),
    url(r'^aq/', include('api.aq.urls')),
]
