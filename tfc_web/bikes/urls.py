from django.conf.urls import url

from bikes.views import current_bikes

urlpatterns = [
    url(r'^current-bikes', current_bikes, name='current-bikes'),
]
