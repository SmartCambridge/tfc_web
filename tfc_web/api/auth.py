from rest_framework.authentication import SessionAuthentication
from authmultitoken.authentication import MultiTokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
import logging

logger = logging.getLogger(__name__)

default_authentication = (MultiTokenAuthentication, SessionAuthentication)
default_permission = (IsAuthenticated,)


class AuthenticateddAPIView(APIView):
    '''
    A APIVier subclass that defaults authn/authx
    '''
    authentication_classes = default_authentication
    permission_classes = default_permission

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
