from django.contrib.auth.decorators import user_passes_test


def smartpanel_valid_user(function):
    """
    Decorator for views that checks that the user is logged in, redirecting
    to the log-in page if necessary, and that the user has accepted the terms and
    conditions of the service or redirecting to that page otherwise.
    """
    logged_in = user_passes_test(
        lambda u: u.is_authenticated
    )
    accepted_tcs = user_passes_test(
        lambda u: hasattr(u, 'smartpanel_user') and u.smartpanel_user.accepted_tcs,
        login_url='smartpanel-tcs'
    )
    return logged_in(accepted_tcs(function))
