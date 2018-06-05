
from datetime import datetime, timezone
from django.conf import settings
from rest_framework import status, serializers
from rest_framework.exceptions import APIException
from rest_framework.schemas import AutoSchema
import coreapi
import coreschema
import json
import logging
import os
import re


# Path to the data store
DATA_PATH = settings.DATA_PATH

logger = logging.getLogger(__name__)


class TFCValidationError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Invalid input'
    default_code = 'invalid'


class EpochField(serializers.Field):
    ''' Serialize a Unix timestamp as an ISO data-time representation '''
    def to_representation(self, obj):
        return datetime.fromtimestamp(
          int(obj), tz=timezone.utc).isoformat()


# maximum days allowed in one hit
MAX_DAYS = 31

list_args_schema = AutoSchema(
    manual_fields=[
        coreapi.Field(
            "start_date",
            required=True,
            location="query",
            schema=coreschema.String(
                description="Start date for returned data (YYYY-MM-DD)")
        ),
        coreapi.Field(
            "end_date",
            location="query",
            schema=coreschema.String(
                description="End date for returned data (YYYY-MM-DD). "
                "Defaults to start_date and must be no more than 31 days "
                "from start_date")
        ),
    ]
)


class ListArgsSerializer(serializers.Serializer):
    ''' Common query string parameters '''
    start_date = serializers.DateField(input_formats=['%Y-%m-%d'])
    end_date = serializers.DateField(input_formats=['%Y-%m-%d'], required=False)

    def validate(self, data):
        ''' Check that end date isn't more than MAX_DAYS days from start_date '''
        if 'end_date' in data:
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError(
                    'end_date \'{0}\' is before start_date \'{1}\''
                    .format(data['end_date'], data['start_date']))
            day_count = (data['end_date'] - data['start_date']).days + 1
            if day_count > MAX_DAYS:
                raise serializers.ValidationError(
                    '{0} days data requested, maximum of {1} allowed'
                    .format(day_count, MAX_DAYS))
        return data


def safe_build(path):
    '''
    Build a pathname from DATA_PATH and path, checking that the
    result is still somewhere within DATA_PATH, allowing for directory
    traversal attempts and symlinks pointing outside DATA_PATH
    '''
    result = os.path.normpath(os.path.join(DATA_PATH, path))
    if result.startswith(os.path.join(DATA_PATH, '')):
        return result
    logger.warning("Requested file outside DATA_PATH: path '{0}', result '{1}'"
                   .format(path, result))
    raise TFCValidationError()


def read_json(path):
    '''
    Read a file containing well-formed JSON, parse it and
    return the result
    '''
    try:
        filename = safe_build(path)
        with open(filename) as f:
            return json.load(f)
    except (json.JSONDecodeError):
        logger.info("Failed to parse '{0}'".format(filename))
        raise
    except (FileNotFoundError):
        logger.info("Failed to open '{0}'".format(filename))
        raise


def read_json_fragments(path):
    '''
    Read a file containing multiple lines, each containing well-formed
    JSON, parse those lines and return the result as an array
    '''
    results = []
    try:
        filename = safe_build(path)
        with open(filename) as f:
            for line in f:
                results.append(json.loads(line))
    except (json.JSONDecodeError):
        logger.info("Failed to parse '{0}' from '{1}'"
                    .format(line, filename))
        raise
    except (FileNotFoundError):
        logger.info("Failed to open '{0}'".format(filename))
        raise
    return results


def get_config(type, id=None, key=None, fieldnames=[]):
    '''
    Get the config for a metric 'type'. If 'id' is None, return the
    entire config. Otherwise return just the config  with identifier 'id'
    in one of the fields 'fieldname' within a list keyed by 'key'.

    Do this by always reading the list.json file (rather than an <id>.json
    file) because it reduces the danger of opening files with user-supplied
    names and because it avoids confusion if the list.json and
    <sensor>.json files diverge.
    '''
    filename = 'sys/data_{0}_config/list.json'.format(type)
    configs = read_json(filename)
    if id is None:
        return configs
    for config in configs[key]:
        for fieldname in fieldnames:
            if config.get(fieldname) == id:
                return config
    logger.info("Config type '{0}'' for '{1}'' not found".format(type, id))
    raise TFCValidationError("Bad ID '{0}'".format(id))
