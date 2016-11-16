##[![Smart Cambridge logo](images/smart_cambridge_logo.jpg)](https://github.com/ijl20/tfc_web) TFC Web

# Part of the Smart Cambridge programme.

## Overview

TFC Web provides the conventional web access to the Rita Real-time Data Platform, connecting to the real-time data
platform via its supported API.

## Installation

This is a django application developed to be used with Python 3. To run the application follow these steps:

> :-\# virtualenv tfc\_web\_venv
> 
> :-\# source tfc\_web\_venv/bin/activate
> 
> (tfc\_web\_venv):\# cd tfc_web
> 
> (tfc\_web\_venv):\# pip install -r requirements.txt
> 
> (tfc\_web\_venv):\# ./manage.py migrate
> 
> (tfc\_web\_venv):\# ./manage.py testserver

You will need as well to set up a cronjob that executes the following command weekly:

> /location_of/tfc\_web\_venv/bin/python3 /location_of/tfc\_web\/manage.py update_bus_stops

