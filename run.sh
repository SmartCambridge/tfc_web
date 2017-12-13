#!/bin/bash

source /home/tfc_prod/tfc_web_venv/bin/activate

cd /home/tfc_prod/tfc_web/tfc_web

echo $(date) "gunicorn started " >> /var/log/tfc_prod/gunicorn.log

nohup gunicorn --reload --log-level debug tfc_web.wsgi & disown



