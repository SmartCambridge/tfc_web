#!/bin/bash

source /home/tfc_prod/tfc_web_venv/bin/activate

cd /home/tfc_prod/tfc_web/tfc_web

echo $(date) "gunicorn started " >> /var/log/tfc_prod/gunicorn.log

nohup gunicorn --reload tfc_web.wsgi >/var/log/tfc_prod/gunicorn.log 2>/var/log/tfc_prod/gunicorn.err & disown



