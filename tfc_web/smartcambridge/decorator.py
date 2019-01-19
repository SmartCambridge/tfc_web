from django.contrib.auth.decorators import user_passes_test


def smartcambridge_valid_user(function):
    """
    Decorator for views that checks that the user is logged in, redirecting
    to the log-in page if necessary, and that the user has accepted the terms and
    conditions of the service or redirecting to that page otherwise.
    """
    # We checked that the user is authenticated, otherwise we won't have access to u.smartcambridge_user
    logged_in = user_passes_test(
        lambda u: u.is_authenticated
    )
    # We check if the user has accepted the terms and conditions
    accepted_tcs = user_passes_test(
        lambda u: hasattr(u, 'smartcambridge_user') and u.smartcambridge_user.accepted_tcs,
        login_url='smartcambridge-tcs'
    )
    return logged_in(accepted_tcs(function))
