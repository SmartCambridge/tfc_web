#!/usr/bin/env python3

'''
A simple smoke tests for all known API endpoints. Run it like this:

$ export TOKEN='.....'    # To set an API token for the target system
$ pytest

Set TARGET env var to target something other than https://smartcambridge.org/api/v1/
'''

import os
import requests
import sys

token = os.getenv('TOKEN')
if not token:
    print('Environment variable "TOKEN" not found')
    sys.exit(1)
target = os.getenv('TARGET', 'https://smartcambridge.org/api/v1/')
print(target)
headers = {'Authorization': 'Token ' + token, 'Referer': 'http://test-runner/'}


def make_request(path, test_key, params={}):
    '''
    Make a request to the API endpoint at _path_, setting CGI parameters
    _params_ and including appropriate authentication headers.

    If _test_key_ is an empty string, check that the returned JSON isn't
    empty; otherwise if _test_key_ isn't None, check that _test_key_ appears
    in the returned JSON and that whatever it points to isn't empty.

    Return the parsed JSON.
    '''
    fullpath = target + path
    r = requests.get(fullpath, params, headers=headers)
    assert r.status_code == 200
    result = r.json()
    if test_key is not None:
        if test_key == '':
            assert len(result) > 0
        else:
            assert test_key in result
            assert len(result[test_key]) > 0
    return result


# Calls should fail without authorization
def test_auth():
    r = requests.get(target + 'aq/')
    assert r.status_code == 401

# AQ endpoint
def test_aq():
    make_request('aq/', 'aq_list')
    make_request('aq/S-1134', '')
    make_request('aq/history/S-1134/NO2/2016-06/', 'Readings')


# # CSN endpoints - not yet implemented
# def test_csn():
#     make_request('csn/', 'app_list')
#     make_request('csn/cambridge-sensor-network/', 'dev_list')
#     make_request('csn/history/cambridge-sensor-network/?'
#                  'dev_eui=90DFFB8187188416&start_date=2019-05-20', 'request_data')
#     make_request('csn/latest/cambridge-sensor-network/763A53FFB342FBD8/', '')
#     # Currently no test data here
#     # make_request('csn/prevous/cambridge-sensor-network/763A53FFB342FBD8/', '')


# Parking endpoint
def test_parking():
    make_request('parking/', 'parking_list')
    make_request('parking/grafton-east-car-park/', '')
    make_request('parking/history/grafton-east-car-park/?start_date=2018-01-01', 'request_data')
    make_request('parking/latest/grafton-east-car-park/', '')
    make_request('parking/previous/grafton-east-car-park/', '')


# Transport endpoint
#
# Testing this is tricky, because we need to create test parameters if we
# expect to actually retrieve any data from most of the endpoints, given
# that the timetable changes continuously. We use the first result from
# journeys_by_time_and_stop() to supply test data for subsequent requests.
def test_transport():

    response = make_request('transport/journeys_by_time_and_stop/?'
                            'stop_id=0500CCITY111&expand_journey=true', 'results')
    a_journey = response['results'][0]

    origin = a_journey['journey']['timetable'][0]['stop']['id']
    departure_time = a_journey['journey']['timetable'][0]['time']
    make_request('transport/departure_to_journey/', 'results',
                 params={'departure_stop_id': origin, 'departure_time': departure_time})

    journey_id = a_journey['journey']['id']
    make_request(f'transport/journey/{journey_id}/', 'timetable')

    make_request('transport/journeys/', 'results')
    # Can't easily do sirivm_add_journey
    make_request('transport/stop/0500CCITY111/', '')
    make_request('transport/stops/', 'results')


# Zone endpoint
def test_zone():
    make_request('zone/', 'zone_list')
    make_request('zone/east_road_in/', '')
    make_request('zone/history/east_road_in/?start_date=2018-01-02', 'request_data')
