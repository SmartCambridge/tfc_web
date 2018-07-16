from tfc_web.settings import *

# Allow configuration of test-suite database from environment variables. A
# variable DJANGO_DB_<key> will override the DATABASES['default'][<key>]
# setting.

_db_envvar_prefix = 'DJANGO_DB_'
for name, value in os.environ.items():
    # Only look at variables which start with the prefix we expect
    if not name.startswith(_db_envvar_prefix):
        continue

    # Remove prefix
    name = name[len(_db_envvar_prefix):]

    # Set value
    DATABASES['default'][name] = value

# Set the API data path to point to the internal test data

DATA_PATH = '/usr/src/app/api/tests/data'
