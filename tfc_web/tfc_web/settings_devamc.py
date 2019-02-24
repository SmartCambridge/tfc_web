from tfc_web.settings import *


DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'tfcweb',
        'HOST': 'localhost',
        'USER': 'postgres',
        'PORT': 32768
    }
}

EMAIL_PORT = 32769
