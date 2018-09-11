import hashlib
import logging
from fnmatch import fnmatchcase
from urllib.parse import urlparse

from django.utils.six import text_type
from django.utils.translation import ugettext_lazy as _

from rest_framework import HTTP_HEADER_ENCODING, exceptions
from rest_framework.authentication import BaseAuthentication

logger = logging.getLogger(__name__)


def get_authorization_header(request):
    """
    Return request's 'Authorization:' header, as a bytestring.
    Hide some test client ickyness where the header can be unicode.
    """
    auth = request.META.get('HTTP_AUTHORIZATION', b'')
    if isinstance(auth, text_type):
        # Work around django test client oddness
        auth = auth.encode(HTTP_HEADER_ENCODING)
    return auth


class MultiTokenAuthentication(BaseAuthentication):
    """
    Simple token based authentication.
    Clients should authenticate by passing the token key in the "Authorization"
    HTTP header, prepended with the string "Token ".  For example:
        Authorization: Token 401f7ac837da42b97f613d789819ff93537bee6a
    """

    keyword = 'Token'
    model = None

    def get_model(self):
        if self.model is not None:
            return self.model
        from .models import Token
        return Token

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth or auth[0].lower() != self.keyword.lower().encode():
            return None

        if len(auth) == 1:
            msg = _('Invalid token header. No credentials provided.')
            logger.info(msg)
            raise exceptions.AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = _('Invalid token header. Token string contains spaces.')
            logger.info(msg)
            raise exceptions.AuthenticationFailed(msg)

        try:
            token = auth[1].decode()
        except UnicodeError:
            msg = _('Invalid token header. Token string contains invalid characters.')
            logger.info(msg)
            raise exceptions.AuthenticationFailed(msg)

        return self.authenticate_credentials(request, token)

    def authenticate_credentials(self, request, key):
        model = self.get_model()
        digest = hashlib.sha256(key.encode()).hexdigest()
        try:
            token = model.objects.select_related('user').get(digest=digest)
        except model.DoesNotExist:
            logger.info('Token with digest "%s" not found', digest)
            msg = _('Invalid token.')
            raise exceptions.AuthenticationFailed(msg)

        if not token.is_active:
            logger.info('Token "%s" inactive', token)
            msg = _('Token inactive or deleted.')
            raise exceptions.AuthenticationFailed(msg)

        if not token.user.is_active:
            logger.info('Token "%s: has inactive user', token)
            msg = _('User inactive or deleted.')
            raise exceptions.AuthenticationFailed(msg)

        if token.referers.count() > 0:
            actual_referer = request.META.get('HTTP_REFERER')
            referer_hostname = ''
            try:
                referer_hostname = urlparse(actual_referer).hostname
            except ValueError:
                pass
            for posibility in token.referers.all():
                if '/' in posibility.value:
                    if fnmatchcase(actual_referer, posibility.value):
                        break
                elif referer_hostname:
                    if fnmatchcase(referer_hostname, posibility.value):
                        break
            else:
                logger.info(
                    'Token "%s" not valid for %s', token, actual_referer
                )
                msg = _('Token not valid for web page %s.' % (actual_referer))
                raise exceptions.AuthenticationFailed(msg)

        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword
