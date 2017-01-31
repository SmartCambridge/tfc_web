##[![Smart Cambridge logo](images/smart_cambridge_logo.jpg)](https://github.com/ijl20/tfc_web) TFC Web

# Part of the Smart Cambridge programme.

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

### Install gunicorn
```
python3 -m pip install gunicorn
```

### Set up Django and tfc_web application

Change to tfc_web Django directory:
```
cd tfc_web/tfc_web
```
Install Django:
```
python3 -m pip install -r requirements.txt
```

### Configure the database:
Install and configure postgreSQL database
```
$ sudo apt-get install postgresql postgresql-contrib
$ sudo -u postgres psql
postgres=# CREATE DATABASE tfcweb;
postgres=# CREATE USER tfcwebuser WITH PASSWORD 'password';
postgres=# ALTER ROLE tfcwebuser SET client_encoding TO 'utf8';
postgres=# ALTER ROLE tfcwebuser SET default_transaction_isolation TO 'read committed';
postgres=# ALTER ROLE tfcwebuser SET timezone TO 'UTC';
postgres=# GRANT ALL PRIVILEGES ON DATABASE myproject TO myprojectuser;
postgres=# \q
```

Put the same password that you have used in the postgreSQL configuration in the secrets.py file inside the 
tfc_web folder (same folder as the settings.py files) following this format:
```
DATABASE_PASSWORD = 'password'
```

### Test basic nginx/ gunicorn / python web access with:
```
gunicorn --bind localhost:8099 tfc_web.echo
```
And with browser visit:
```
http://localhost/test/
```
You should see "Hello World"


### Collect static files for Django
```
./manage.py collectstatic

```

### Run test server
```
gunicorn --reload --log-level debug tfc_web.wsgi
```
Test with access to:
```
http://localhost/web
```

### Periodically update route/timetable data

You will need as well to set up a cronjob that executes the following command weekly:

```
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_stops
```

## Dependencies

This project uses:
- [Python3](https://www.python.org/)
- [Django](https://www.djangoproject.com/)
- [gunicorn](http://gunicorn.org/)
- [Leaflet](http://leafletjs.com/)
- [Leaflet Moving Marker](https://github.com/ewoken/Leaflet.MovingMarker)
- [Material Design Lite](https://getmdl.io/)
