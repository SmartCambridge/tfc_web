import logging

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from authmultitoken.authentication import MultiTokenAuthentication


logger = logging.getLogger(__name__)


class TokenRateThrottle(SimpleRateThrottle):
    """
    Limits the rate of API calls that may be made by a given user.
    The user's token will be used as a unique cache key if the user has one;
    failing that the user's user ID will be used; for anonymous requests,
    the IP address of the request will be used.

    Throttling rate set in settings.py
    """
    scope = 'api_token'

    def get_cache_key(self, request, view):
        if request.auth is not None:
            ident = request.auth.digest
        elif request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)

        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class BurstTokenRate(TokenRateThrottle):
    scope = 'token_burst'


class SustainedTokenRate(TokenRateThrottle):
    scope = 'token_sustained'


default_authentication = (MultiTokenAuthentication, SessionAuthentication)
default_permission = (IsAuthenticated,)
default_throttle = (BurstTokenRate, SustainedTokenRate,)


class AuthenticateddAPIView(APIView):
    '''
    A APIVier subclass that defaults authn/authz/throttling
    '''
    authentication_classes = default_authentication
    permission_classes = default_permission
    throttle_classes = default_throttle

    def initial(self, request, *args, **kwargs):
        ''' Hook initial() to log authenticated requests '''
        super().initial(request, *args, **kwargs)
        name = request.auth.name if request.auth is not None else ''
        logger.info(
            'AUTH: |%s|%s|%s|',
            request.path,
            request.user.get_username(),
            name
        )
