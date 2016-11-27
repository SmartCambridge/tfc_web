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

### Set up nginx for Django app on port 8000

Copy nginx conf file and restart nginx:
```
sudo cp tfc_web/config/nginx/includes/tfc_web_port_80.conf /etc/nginx/includes
sudo service nginx restart
```
Install uWSGI
```
python3 -m pip install uwsgi
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

Complete application installation:
```
./manage.py migrate
```

Start application server:
```
./manage.py runserver
```
### Collect static files for Django
```
./manage.py collectstatic

```

### Periodically update route/timetable data

You will need as well to set up a cronjob that executes the following command weekly:

```
/home/tfc_prod/tfc_web_venv/bin/python3 /home/tfc_prod/tfc_web/tfc_web/manage.py update_bus_stops
```

## Dependencies

This project uses:
- [Leaflet](http://leafletjs.com/)
- [Leaflet Moving Marker](https://github.com/ewoken/Leaflet.MovingMarker)
- [Material Design Lite](https://getmdl.io/)
