[![Smart Cambridge logo](images/smart_cambridge_logo.jpg)](https://github.com/ijl20/tfc_web)

# tfc_web: the web UI of the SmartCambridge program

## Overview

TFC Web provides the conventional web access to the Rita Real-time Data Platform, connecting to the real-time data
platform via its supported API.

## Installation

This is a django application developed to be used with Python 3. To run the application follow these steps:

Check python3 version to ensure it's installed and up to date:
```
python3 -V
```
Assuming that's ok, install pip
```
sudo apt install -y python3-pip
python3 -m pip install --upgrade pip
```
Check pip version with
```
python3 -m pip --version
```

Install virtualenv:
```
sudo apt install -y python3-venv
```
Create virtualenv for tfc_web:
```
python3 -m venv tfc_web_venv
```
Activate tfc_web virtualenv:
```
source tfc_web_venv/bin/activate
```

Get the tfc_web source
```
(tfc_web_venv):# git clone https://github.com/ijl20/tfc_web.git
```

## Secrets

You will need to set up some secrets in a file called secrets.py inside tfc_web/tfc_web folder where the settings
files are stored. Secrets need to be:

```
SECRET_KEY = ''
TNDS_USERNAME = ''
TNDS_PASSWORD = ''
DATABASE_PASSWORD = ''
LW_APP_EUI = ''
LW_APP_API_KEY = ''
LW_API_KEY = ''
TFC_SERVER_CSN_TOKEN = ''
OFO_TOKEN = ''
NRE_API_KEY = ''
METOFFICE_KEY = ''
TFC_PROD_PASSWORD = ''
SYSTEM_API_TOKENS = {
    'TFC_WEB INTERNAL': {
        'key': '',
        'digest': '',
        'restrictions': [ '', ]
    },
}
```

* SECRET_KEY is the standard django SECRET_KEY, look in django documentation for how to set up a django secret key.
* TNDS_USERNAME and TNDS_PASSWORD are the username and password used to download transport data from TNDS
(stop information and timetables).
* LW_APP_EUI, LW_APP_API_KEY, and LW_API_KEY are the loraWAN secrets needed for
set up devices in the loraWAN network, these keys need to be retrieved from Everynet panel.
* TFC_SERVER_CSN_TOKEN is the token shared with tfc_server for retrieving data
from loraWAN sensors.
* OFO_TOKEN is the token used to communicatie with ofo server to retrieve bikes data, to know
how to retrieve this token visit: https://github.com/ubahnverleih/WoBike/blob/master/Ofo.md
* NRE_API_KEY is the token used to access the National Rail Enquiries 'Live
Departure Boards Web Service' (LDBWS) used by the Station Board SmartPanel widget. See
http://www.nationalrail.co.uk/100296.aspx
* METOFFICE_KEY is the token used to access the Met Office's DataPoint API used by the
Weather Forecast SmartPanel widget. See https://www.metoffice.gov.uk/datapoint
* TFC_PROD_PASSWORD is the password for the TFC_PROD Django user
* SYSTEM_API_TOKENS contains the list of API tokens (the key, corresponding digest, and
a list of referer restrictions) that are assigned to the TFC_PROD user.

### Set up Django and tfc_web application

Change to tfc_web Django directory (with the virtual env active):
```
cd tfc_web/tfc_web
```
Install tfc_web python dependencies
```
python3 -m pip install -r requirements.txt
```

### Configure the database:
Install and configure postgreSQL database:

Check running postgresql with:
```
sudo systemctl status postgresql@14-main.service
```

Backup an existing database with:
```
sudo -u postgres pg_dump -c tfcweb >tfcweb_backup_2023-07-21.sql
```

Check if installed postgresql packages with:
```
dpkg -l | grep postgres
```

If necessary remove existing postgresql packages with:
```
sudo apt --purge remove postgresql-*
sudo rm -r /var/lib/postgresql
```

Install postgresql packages:
```
sudo apt install postgresql-14 postgresql-common postgresql-client-14 postgresql-client-common postgresql-14-postgis-3 postgresql-14-postgis-3-scripts
```

Check with
```
sudo systemctl status postgresql@14-main.service
```

Create tfcweb database, tfc_prod user, collect password from tfc_web secrets.py:
```
sudo -u postgres psql
create database tfcweb;
create role tfc_prod LOGIN PASSWORD '<pwd>';
```

Restore tfcweb database from previous backup:
```
sudo -u postgres psql tfcweb <tfcweb_backup_2023-07-21.sql 
```

Check tables exist ok:
```
sudo -u postgres psql
\c tfcweb
\dt
```

The Django system is using the `tfcweb` database which can be viewed in `psql` via:
```
sudo -u postgres psql [-d tfcweb]
...
postgres# \l
... lists databases
postgres# \c tfcweb
You are now connected to database "tfcweb" as user "postgres".
postgres#
```
List tables with:
```
postgres# \dt
```

Show table structure with (e.g.):
```
postgres# \d auth_user
```

Check table sizes with:
```
SELECT *, pg_size_pretty(total_bytes) AS total
    , pg_size_pretty(index_bytes) AS index
    , pg_size_pretty(toast_bytes) AS toast
    , pg_size_pretty(table_bytes) AS table
  FROM (
  SELECT *, total_bytes-index_bytes-coalesce(toast_bytes,0) AS table_bytes FROM (
      SELECT c.oid,nspname AS table_schema, relname AS table_name
              , c.reltuples AS row_estimate
              , pg_total_relation_size(c.oid) AS total_bytes
              , pg_indexes_size(c.oid) AS index_bytes
              , pg_total_relation_size(reltoastrelid) AS toast_bytes
          FROM pg_class c
          LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE relkind = 'r'
  ) a
) a;
```

Set users who have never logged in to "inactive":
```
update auth_user set is_active = FALSE where last_login is null;
```
Deactivate users inactive for more than X days, e.g. for X = 6 months (180 days):
```
update auth_user set is_active = FALSE where last_login < now()::date - 180;
```

List active users with:
```
select email, username, last_login, is_active from auth_user where is_active = TRUE;
```

Note an existing postgresql installation can be removed as here:
[https://askubuntu.com/questions/32730/how-to-remove-postgres-from-my-installation](https://askubuntu.com/questions/32730/how-to-remove-postgres-from-my-installation).

E.g. to install postgresql-14 see [https://www.postgresql.org/download/linux/ubuntu/](https://www.postgresql.org/download/linux/ubuntu/).

```
$ sudo apt install postgresql-14 postgresql-contrib postgresql-14-postgis-3
```

Set up initial configuration executing tfc_web/migrations and making sure tfcweb database has already been set up.

The existing smartcambridge.org database can be copied:
```
sudo -u postgres /usr/bin/pg_dumpall --clean >backup.sql
```
and restore with:
```
sudo -u postgres psql -f "backup.sql" postgres
```

Apply all the migrations
```
python3 manage.py migrate
```

### Collect static files for Django
```
python3 manage.py collectstatic

```

### Run test server
```
gunicorn --reload --log-level debug tfc_web.wsgi
```
Test with access to:
```
http://localhost/
```

### Periodically update route/timetable data

You will need as well to set up a cronjob that executes the following command weekly:

```
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_stops
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_info
```

## Setup tfc_prod Django user

```
cd /home/tfc_prod/tfc_web/tfc_web
./manage.py setup_tfc_prod
```

This replaces the previous approach of manually creating tfc_prod and then running
`/home/tfc_prod/tfc_web/scripts/insert_tfc_web_internal_token`. It is safe to
run `./manage.py setup_tfc_prod` even if it may have been run before.

## Dependencies

This project uses:
- [Python3](https://www.python.org/)
- [Django](https://www.djangoproject.com/)
- [gunicorn](http://gunicorn.org/)
- [Leaflet](http://leafletjs.com/)
- [Leaflet Moving Marker](https://github.com/ewoken/Leaflet.MovingMarker)
- [Material Design Lite](https://getmdl.io/)
- [django-allauth](https://github.com/pennersr/django-allauth)

## Overriding default Django config

The `run.sh` script in the root of this repository is used to startup
the application under gunicorn at system boot and at other times. This
script sources a file

    /home/tfc_prod/tfc_web_envvars

if it exists before starting gunicorn. One use for this is to export
environment variables that affect the application's behaviour.

This can be used to override the default Django configuration.
Django reads the name of the configuration module to use from the environment
variable `DJANGO_SETTINGS_MODULE`. This is defaulted by `tfc_web/tfc_web/wsgi.py`
to `tfc_web.settings_production` but isn't altered if already set. By setting
this variable in `tfc_web_envvars` you can choose a different module.

A common choice is `tfc_web.settings` which is better suited the development
work. Alternatively you could create your own module which imports from
`tfc_web.settings` and then overrides as many parameters as you want (see
`tfc_web/tfc_web/setings_production.py` and `tfc_web/tfc_web/setings_dev.py`
for examples).
