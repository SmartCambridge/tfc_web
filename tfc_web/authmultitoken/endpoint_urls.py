from django.conf.urls import url

from .views import obtain_auth_token

urlpatterns = [
    url(r'^api-token-auth/', obtain_auth_token, name='api-token-auth'),
]
