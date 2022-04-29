#!/bin/bash

echo Killing $(ps aux | grep gunicorn | grep -v grep | wc -l) gunicorn instances

pkill -9 gunicorn

echo After pkill, $(ps aux | grep gunicorn | grep -v grep | wc -l) gunicorn instances running

