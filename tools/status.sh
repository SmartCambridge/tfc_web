#!/bin/bash

echo $(ps aux | grep gunicorn | grep -v grep | wc -l) gunicorn instances running
