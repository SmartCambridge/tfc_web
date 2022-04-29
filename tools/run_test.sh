#!/bin/bash
source ~/tfc_web_venv/bin/activate
cd ~/tfc_web/tfc_web
# gunicorn --reload --log-level debug tfc_web.wsgi
python manage.py runserver --settings=tfc_web.settings_dev 0.0.0.0:8000
