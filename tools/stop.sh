#!/bin/bash

echo Killing all $(ps aux | grep gunicorn | grep -v grep | wc -l) gunicorn instances

pkill -9 gunicorn

sleep 2

echo After pkill, $(ps aux | grep gunicorn | grep -v grep | wc -l) gunicorn instances running

