from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _


class AuthMultiTokenConfig(AppConfig):
    name = 'authmultitoken'
    verbose_name = _("Auth Multi Token")
