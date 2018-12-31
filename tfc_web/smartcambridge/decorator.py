from django.contrib.auth.decorators import user_passes_test
import logging

logger = logging.getLogger(__name__)

def smartcambridge_valid_user(function):
    """
    Decorator for views that checks that the user is logged in, redirecting
    to the log-in page if necessary, and that the user has accepted the terms and
    conditions of the service or redirecting to that page otherwise.
    """
    logged_in = user_passes_test(
        lambda u: u.is_authenticated
    )
    accepted_tcs = user_passes_test(
        lambda u: hasattr(u, 'smartcambridge_user') and u.smartcambridge_user.accepted_tcs,
        login_url='smartcambridge-tcs'
    )
    return logged_in(accepted_tcs(function))

def smartcambridge_admin( user_function ):
    """
    Decorator for views that checks that the user is logged in and is a staff
    member, redirecting to the login page if necessary.
    """
    logged_in = user_passes_test(
        lambda u: u.is_authenticated
    )
    is_admin = user_passes_test( lambda u: u.is_active and u.is_staff,
                                 login_url='admin:login'
                               )
    return logged_in(is_admin(user_function))

