from django.conf.urls import url

from .views import manage_tokens, create_token, manage_token, add_restriction

urlpatterns = [
    url(r'^tokens/', manage_tokens, name='manage_tokens'),
    url(r'^create-token/', create_token, name='create_token'),
    url(r'^manage-token/(?P<token_id>[-\w]+)', manage_token, name='manage_token'),
    url(r'^add-restriction/(?P<token_id>[-\w]+)', add_restriction, name='add_restriction'),
]
