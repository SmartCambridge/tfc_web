"""tfc_web URL Configuration for Parking

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.8/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url
from django.views.generic import TemplateView
from aq import views


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name='aq/home.html'), name='aq_home'),
    url(r'^map/$', views.aq_map, name='aq_map'),
    url(r'^list/$', views.aq_list, name='aq_list'),
    url(r'^plot/(?P<station_id>[-\w]+)', views.aq_plot, name='aq_plot')
]
