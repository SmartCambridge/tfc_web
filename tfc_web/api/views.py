
from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.http import is_safe_url

from smartcambridge.decorator import smartcambridge_valid_user


@smartcambridge_valid_user
def login_and_agree(request):
    '''
    Trivial view to redirect to 'next' after confirming
    that the user is authenticated and has agreed to the SmartCambridge
    TCs
    '''
    redirect_to = request.GET.get('next')
    url_is_safe = is_safe_url(
        url=redirect_to,
        allowed_hosts=settings.ALLOWED_HOSTS,
        require_https=request.is_secure(),
    )
    if url_is_safe and redirect_to:
        return redirect(redirect_to)
    return redirect(reverse('api_home'))
