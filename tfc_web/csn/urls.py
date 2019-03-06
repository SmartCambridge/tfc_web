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
    url(r'^$', TemplateView.as_view(template_name='csn/home.html'), name='csn-home'),
    url(r'^devices', views.devices, name='csn_devices'),
    url(r'^device/new$', views.new_device, name='csn_new_device'),
    url(r'^device/delete', views.delete_device, name='csn_delete_device'),
    url(r'^device/(?P<device_id>\w+)/', views.device, name='csn_device'),
    url(r'^connections/new$', views.new_connection, name='csn_new_connection'),
    url(r'^connections/delete', views.delete_connection, name='csn_delete_connection'),
    url(r'^connections/confirmation/(?P<connection_id>[\w\-]+)/', views.confirm_connection_id,
        name='csn_connection_confirmation'),
    url(r'^connections/devices/(?P<connection_id>[\w\-]+)/', views.devices_per_connection,
        name='csn_devices_per_connection'),
    url(r'^connections/(?P<connection_id>[\w\-]+)/', views.connection, name='csn_connection'),
    url(r'^connections', views.connections, name='csn_connections'),

    # Forum
    url(r'^forum/', include(board.urls)),
]
