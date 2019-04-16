from tfc_web.settings import *

DEBUG = False

DEFAULT_FROM_EMAIL = "smart-cambridge@cl.cam.ac.uk"
EMAIL_HOST = "ppsw.cam.ac.uk"
EMAIL_PORT = 25

CSN_PREFIX = 'prod'

LOGGING['loggers']['django.request'] = {
    'handlers': ['mail_admins'],
    'level': 'ERROR',
    'propagate': False,
    }
