from django.conf.urls import url
from rest_framework.documentation import include_docs_urls
from django.conf.urls import include

urlpatterns = [
    url(r'^docs/', include_docs_urls(title='TFC API',
                                     authentication_classes=[],
                                     permission_classes=[])),
    url(r'^parking/', include('api.parking.urls')),
    url(r'^zones/', include('api.zones.urls')),
]
