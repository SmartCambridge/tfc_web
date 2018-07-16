from django.conf.urls import url

from .views import manage_tokens, create_token

urlpatterns = [
    url(r'^tokens/', manage_tokens, name='manage_tokens'),
    url(r'^create-token/', create_token, name='create_token'),
]
