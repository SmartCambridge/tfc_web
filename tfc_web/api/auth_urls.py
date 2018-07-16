"""
Login and logout views for the browsable API.
Add these to your root URLconf if you're using the browsable API and
your API requires authentication:
    urlpatterns = [
        ...
        url(r'^auth/', include('rest_framework.urls'))
    ]
You should make sure your authentication settings include `SessionAuthentication`.
"""
import allauth
from django.conf.urls import url


app_name = 'rest_framework'
urlpatterns = [
    url(r'^login/$', allauth.account.views.LoginView.as_view(), name='login'),
    url(r'^logout/$', allauth.account.views.LogoutView.as_view(), name='logout'),
]
