"""
WSGI DEV config for tfc_web project. As production but uses 'dev' tfc_web.settings.py as below.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tfc_web.settings_devijl")

application = get_wsgi_application()
