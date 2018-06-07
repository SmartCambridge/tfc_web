from tfc_web.settings import *

DEBUG = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True

DEFAULT_FROM_EMAIL = "smart-cambridge@cl.cam.ac.uk"
EMAIL_HOST = "ppsw.cam.ac.uk"
EMAIL_PORT = 25

TFC_SERVER_CSN_API = "http://localhost/httpmsg/A/tfc.manager/msgrouter/A"
