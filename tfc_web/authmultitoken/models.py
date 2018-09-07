import binascii
import hashlib
import logging
import os

from django.conf import settings
from django.db import models
from django.utils.encoding import python_2_unicode_compatible
from django.utils.translation import ugettext_lazy as _

logger = logging.getLogger(__name__)


class TokenManager(models.Manager):
    def create(self, user, name):

        token = binascii.hexlify(os.urandom(20)).decode()
        digest = hashlib.sha256(token.encode()).hexdigest()

        super(TokenManager, self).create(
            digest=digest, format=1, user=user, name=name)
        # Note only the token - not the AuthToken object - is returned
        # and the token isn't stored anywhere
        return token


@python_2_unicode_compatible
class Token(models.Model):

    objects = TokenManager()

    digest = models.CharField(_("Digest"), max_length=64, unique=True,
                              db_index=True)

    format = models.IntegerField(_("Key format"))

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name='auth_multi_tokens',
        on_delete=models.CASCADE, verbose_name=_("User")
    )

    name = models.CharField(_("Token name"), max_length=64)

    is_active = models.BooleanField(_("Active"), default=True)

    created = models.DateTimeField(_("Created"), auto_now_add=True)

    class Meta:
        unique_together = (('user', 'name'),)
        verbose_name = _("Token")
        verbose_name_plural = _("Tokens")

    def __str__(self):
        return '%s - %s' % (self.user, self.name)


@python_2_unicode_compatible
class Referer(models.Model):

    token = models.ForeignKey(
        Token, related_name='referers',
        on_delete=models.CASCADE, verbose_name=_("Token")
    )

    value = models.CharField(_("Value"), max_length=256)

    def __str__(self):
        return self.value
