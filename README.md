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
```

SECRET_KEY is the standard django SECRET_KEY, look in django documentation for how to set up a django secret key.
TNDS_USERNAME and TNDS_PASSWORD are the username and password used to download transport data from TNDS 
(stop information and timetables). LW_APP_EUI, LW_APP_API_KEY, and LW_API_KEY are the loraWAN secrets needed for 
set up devices in the loraWAN network, these keys need to be retrieved from Everynet panel. 
TFC_SERVER_CSN_TOKEN is the token shared with tfc_server for retrieving data
from loraWAN sensors. OFO_TOKEN is the token used to communicatie with ofo server to retrieve bikes data, to know 
how to retrieve this token visit: https://github.com/ubahnverleih/WoBike/blob/master/Ofo.md

## Setup tfc_prod Django user

Create a Django user 'tfc_prod' with associated email address
'cl-smartcambridge@lists.cam.ac.uk' and the password stored in the secrets file.

Run

```
/home/tfc_prod/tfc_web/scripts/insert_tfc_web_internal_token
```

and when prompted supply the value of LOCAL_API_KEY_HASH from `secrets.py`.

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
