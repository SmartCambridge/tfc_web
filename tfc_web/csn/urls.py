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
from django.conf.urls import url, include
from django.views.generic import TemplateView
from csn import views
from machina.app import board


urlpatterns = [
    url(r'^$', TemplateView.as_view(template_name='csn/home.html'), name='csn_home'),
    url(r'^devices', views.devices, name='csn_devices'),
    url(r'^device/new$', views.new_device, name='csn_new_device'),
    url(r'^device/delete', views.delete_device, name='csn_delete_device'),
    url(r'^device/change-app', views.change_device_app, name='csn_change_device_app'),
    url(r'^device/(?P<device_id>\w+)/', views.device, name='csn_device'),
    url(r'^apps', views.applications, name='csn_applications'),
    url(r'^app/new$', views.new_app, name='csn_new_app'),
    url(r'^app/delete', views.delete_app, name='csn_delete_app'),
    url(r'^app/(?P<app_id>[\w\-]+)/', views.application, name='csn_app'),
    url(r'^network', views.network_info, name='csn_network_info'),
    url(r'^gateway/(?P<gw_mac>\w+)/', views.gateway, name='csn_gateway'),

    # Forum
    url(r'^forum/', include(board.urls)),
]
