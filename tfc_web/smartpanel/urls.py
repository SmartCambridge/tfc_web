from django.conf.urls import url
from django.views.generic import TemplateView
from smartpanel.views import smartpanel
from smartpanel.views.decorator import smartpanel_valid_user
from smartpanel.views.widgets import weather, station_board


urlpatterns = [
    url(r'^$', smartpanel_valid_user(TemplateView.as_view(template_name="smartpanel/home.html")), name='smartpanel-home'),
    url(r'^display/new/$', smartpanel.new_display, name='smartpanel-new-display'),
    url(r'^display/my/', smartpanel.my_displays, name='smartpanel-list-my-displays'),
    url(r'^display/(?P<slug>[-\w]+)/edit/', smartpanel.edit_display, name='smartpanel-edit-display'),
    url(r'^display/(?P<slug>[-\w]+)/delete/', smartpanel.delete_display, name='smartpanel-delete-display'),
    url(r'^display/(?P<display_slug>[-\w]+)/refresh/(?P<layout_slug>\w+)/(?P<version>\d+)', smartpanel.display_refresh,
        name='smartpanel-display-refresh'),
    # url(r'^display/list/', smartpanel.displays, name='smartpanel-list-displays'),
    url(r'^display/(?P<slug>[-\w]+)/', smartpanel.display, name='smartpanel-display'),
    url(r'^displays/debug/', smartpanel.displays_debug, name='smartpanel-displays-debug'),
    url(r'^design/', smartpanel.design, name='smartpanel-design'),
    url(r'^layout/my/$', smartpanel.my, name='smartpanel-layout-my'),
# TODO Re-enamble once opt-in option done
#    url(r'^layout/list/$', smartpanel.all, name='smartpanel-layout-all'),
    url(r'^layout/(?P<slug>\w+)/config/$', smartpanel.layout_config, name='smartpanel-layout-config'),
    url(r'^layout/delete/$', smartpanel.layout_delete, name='smartpanel-layout-delete'),
    url(r'^layout/(?P<slug>\w+)/$', smartpanel.layout, name='smartpanel-layout'),
    url(r'^weather$', weather.weather, name='smartpanel-weather'),
    url(r'^station_board$', station_board.station_board, name='station-board'),
    url(r'^info/$', TemplateView.as_view(template_name="smartpanel/info.html"), name='smartpanel-info'),
    url(r'^tcs/accept$', smartpanel.accept_tcs, name='smartpanel-accept-tcs'),
    url(r'^tcs/$', smartpanel.tcs, name='smartpanel-tcs'),
]
