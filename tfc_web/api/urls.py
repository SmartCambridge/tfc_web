from django.conf.urls import include
from django.conf.urls import url
from django.views.generic import TemplateView

from rest_framework.documentation import include_docs_urls

from authmultitoken.views import (
    manage_tokens, create_token, manage_token, add_restriction
)

from .views import login_and_agree, nginx_auth_probe, download, download_schema
from smartcambridge.decorator import smartcambridge_valid_user


api_description = '''
Programmatic access to data held by the Smartcambridge project.

See [the main API documentation](/api/) for important information about
using this API, **in particular about the need for authentication**.
'''


# These are the URL patterns for which documentation should
# be generated
docpatterns = [
     url(r'^api/v1/parking/', include('parking.api.urls')),
     url(r'^api/v1/traffic/', include('traffic.api.urls')),
     url(r'^api/v1/aq/', include('aq.api.urls')),
     url(r'^api/v1/transport/', include('transport.api.urls')),
     ]

# These are all the URLs. The near-duplication of the URLs above
# is regretted
urlpatterns = [
    url(r'^$',
        TemplateView.as_view(template_name="api/index.html"), name="api_home"),

    url(r'^program/$',
        TemplateView.as_view(template_name="api/program_api.html"), name="program_api"),

    url(r'download/$', download, name='download_api'),
    url(r'download/(?P<feed>[-\w]+)-schema/$', download_schema, name="downlod_schema"),

    url(r'login-and-agree/', login_and_agree, name="login-and-agree"),

    # Define these here, rather then via include('authmultitoken.html_urls',
    # so we can wrap them with smartcambridge_valid_user()
    url(r'^tokens/',
        smartcambridge_valid_user(manage_tokens), name='manage_tokens'),
    url(r'^create-token/',
        smartcambridge_valid_user(create_token), name='create_token'),
    url(r'^manage-token/(?P<token_id>[-\w]+)',
        smartcambridge_valid_user(manage_token), name='manage_token'),
    url(r'^add-restriction/(?P<token_id>[-\w]+)',
        smartcambridge_valid_user(add_restriction), name='add_restriction'),
    url(r'^nginx-auth-probe/', nginx_auth_probe, name='nginx_auth_probe'),

    url(r'^auth/', include('api.auth_urls')),
    url(r'^docs/', include_docs_urls(
        title='SmartCambridge API',
        description=api_description,
        patterns=docpatterns)),
    url(r'^v1/parking/', include('parking.api.urls')),
    url(r'^v1/traffic/', include('traffic.api.urls')),
    url(r'^v1/aq/', include('aq.api.urls')),
    url(r'^v1/transport/', include('transport.api.urls')),
    ]
