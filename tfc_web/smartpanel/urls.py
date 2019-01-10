from django.conf.urls import url
from django.views.generic import TemplateView

from smartcambridge.decorator import smartcambridge_valid_user
from smartpanel.views import smartpanel
from smartpanel.views.widgets import weather, station_board, bikes, rss_reader


urlpatterns = [
    url(r'^$', smartcambridge_valid_user(TemplateView.as_view(template_name="smartpanel/home.html")), name='smartpanel-home'),
    url(r'^display/new/$', smartpanel.new_display, name='smartpanel-new-display'),
    url(r'^display/(?P<slug>[-\w]+)/edit/', smartpanel.edit_display, name='smartpanel-edit-display'),
    url(r'^display/delete/$', smartpanel.display_delete, name='smartpanel-display-delete'),
    url(r'^display/(?P<display_slug>[-\w]+)/refresh/(?P<layout_slug>\w+)/(?P<version>\d+)', smartpanel.display_refresh,
        name='smartpanel-display-refresh'),
    # url(r'^display/list/', smartpanel.displays, name='smartpanel-list-displays'),
    url(r'^display/(?P<slug>[-\w]+)/', smartpanel.display, name='smartpanel-display'),
    url(r'^displays/debug/', smartpanel.displays_debug, name='smartpanel-displays-debug'),
    url(r'^displays/map/', smartpanel.displays_map, name='smartpanel-map-my-displays'),
    url(r'^displays/list/', smartpanel.displays_list, name='smartpanel-list-my-displays'),
    url(r'^design/', smartpanel.design, name='smartpanel-design'),
    url(r'^layouts/list/$', smartpanel.layouts_list, name='smartpanel-list-my-layouts'),
# TODO Re-enamble once opt-in option done
#    url(r'^layout/list/$', smartpanel.all, name='smartpanel-layout-all'),
    url(r'^layout/(?P<slug>\w+)/config/$', smartpanel.layout_config, name='smartpanel-layout-config'),
    url(r'^layout/(?P<slug>\w+)/export/$', smartpanel.layout_export, name='smartpanel-layout-export'),
    url(r'^layout/import/$', smartpanel.layout_import, name='smartpanel-layout-import'),
    url(r'^layout/delete/$', smartpanel.layout_delete, name='smartpanel-layout-delete'),
    url(r'^layout/(?P<slug>\w+)/$', smartpanel.layout, name='smartpanel-layout'),
    url(r'^pocket/$', smartpanel.pocket, name='smartpanel-pocket'),
    url(r'^pocket/logger/$', smartpanel.pocket_logger),
    url(r'^info/$', TemplateView.as_view(template_name="smartpanel/info.html"), name='smartpanel-info'),
    # Widgets specific URLs
    url(r'^weather$', weather.weather),
    url(r'^weather/2$', weather.weather, {'ver': 2}, name='smartpanel-weather'),
    url(r'^rss_reader$', rss_reader.rss_reader, name='smartpanel-rss-reader'),
    url(r'^station_board$', station_board.station_board),
    url(r'^station_board/2$', station_board.station_board, {'ver': 2}, name='station-board'),
    url(r'^widgets/bikes', bikes.bikes, name='smartpanel-widgets-bikes'),
]
