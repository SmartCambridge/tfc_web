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


### Set up Django and tfc_web application

Change to tfc_web Django directory:
```
cd tfc_web/tfc_web
```
Install tfc_web python dependencies
```
python3 -m pip install -r requirements.txt
```

### Configure the database:
Install and configure postgreSQL database
```
$ sudo apt-get install postgresql postgresql-contrib postgis
```

Set up initial configuration executing tfc_web/migrations and making sure tfcserver database has already been set up.

Apply all the migrations
```
python3 manage.py migrate --database
```

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
http://localhost/
```

### Periodically update route/timetable data

You will need as well to set up a cronjob that executes the following command weekly:

```
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_stops
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_info
```

## Dependencies

This project uses:
- [Python3](https://www.python.org/)
- [Django](https://www.djangoproject.com/)
- [gunicorn](http://gunicorn.org/)
- [Leaflet](http://leafletjs.com/)
- [Leaflet Moving Marker](https://github.com/ewoken/Leaflet.MovingMarker)
- [Material Design Lite](https://getmdl.io/)
- [django-machina](https://github.com/ellmetha/django-machina)
- [django-allauth](https://github.com/pennersr/django-allauth)
