from tfc_web.settings import *
from tfc_web.secrets import DATABASE_PASSWORD

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'tfcweb',
        'USER': 'tfcwebuser',
        'PASSWORD': DATABASE_PASSWORD,
        'HOST': 'localhost',
        'PORT': '',
    }
}
