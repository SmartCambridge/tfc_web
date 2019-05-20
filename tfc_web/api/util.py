from datetime import datetime, timezone
from django.conf import settings
from pathlib import Path
from urllib.request import Request, urlopen
from rest_framework import status, serializers
from rest_framework.exceptions import APIException

import codecs
import json
import logging

# Path to the data store
DATA_PATH = Path(settings.DATA_PATH)


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


class ListArgsSerializer(serializers.Serializer):
    ''' Common query string parameters '''
    start_date = serializers.DateField(input_formats=['%Y-%m-%d'])
    end_date = serializers.DateField(input_formats=['%Y-%m-%d'], required=False)
    dev_eui = serializers.CharField(required=False)

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
    Build a pathname from DATA_PATH and path, checking that none of the
    components of the result are '..' to prevent directory traversal
    attempts. A better approach would be to use Path.resolve(), except
    that resolves symlinks and we rely on them for correct operation.
    '''
    result = DATA_PATH.joinpath(path)
    for component in result.parts:
        if component == '..':
            logger.error(
                "Requested file path contains '..': '{0}'".format(result))
            raise TFCValidationError()
    return result


def read_json(path):
    '''
    Read a file containing well-formed JSON, parse it and
    return the result
    '''
    file = safe_build(path)
    try:
        with file.open() as f:
            return json.load(f)
    except json.JSONDecodeError:
        logger.error("Failed to parse '{0}'".format(file))
        raise
    except FileNotFoundError:
        logger.info("Failed to open '{0}'".format(file))
        raise


def read_json_fragments(path):
    '''
    Read a file containing multiple lines, each containing well-formed
    JSON, parse those lines and return the result as an array
    '''
    results = []
    file = safe_build(path)
    try:
        with file.open() as f:
            for line in f:
                results.append(json.loads(line))
    except json.JSONDecodeError:
        logger.error("Failed to parse '{0}' from '{1}'"
                     .format(line, file))
        raise
    except FileNotFoundError:
        logger.info("Failed to open '{0}'".format(file))
        raise
    return results


def get_dir_items(path, is_dir=False, suffix=None):
    '''
    Return a list of items represented by the names of files or directories
    in _path_. Require the directory entries to be files, unless _is_dir_
    is true, in which case require them to be directories. If _suffix_
    is not None then require that the directory entries end in _suffix_
    and remove it from the returned names
    '''
    result = []
    for f in safe_build(path).iterdir():
        if (f.is_file() and is_dir) or (f.is_dir() and not is_dir):
            continue
        if suffix and f.suffix != suffix:
            continue
        result.append(f.stem)
    return result


def get_config(type, id=None, key=None, id_field_name=None):
    '''
    Get the config for a metric 'type'. If 'id' is None, return the
    entire config. Otherwise return just the config  with identifier 'id'
    in field 'id_field_name' within a list keyed by 'key'.

    Do this by reading the JSON list file (rather than an <id>.json
    file) because it reduces the danger of opening files with user-supplied
    names and because it avoids confusion if the list file and
    <id>.json files diverge.

    Try to read 'list_all.json' and fall back to 'list.json' to support
    zones in which list.json isn't complete.
    '''
    try:
        filename = 'sys/data_{0}_config/list_all.json'.format(type)
        configs = read_json(filename)
    except FileNotFoundError:
        filename = 'sys/data_{0}_config/list.json'.format(type)
        configs = read_json(filename)
    if id is None:
        return configs
    for config in configs[key]:
        if config.get(id_field_name) == id:
            return config
    logger.error('Config type {0} for "{1}" not found'.format(type, id))
    raise TFCValidationError('Bad ID "{0}"'.format(id))


def do_api_call(query):
    '''
    Helper function for authenticated access to the API
    '''
    reader = codecs.getreader("utf-8")
    query = Request(settings.NEW_API_ENDPOINT + query)
    query.add_header('Authorization', 'Token ' + settings.LOCAL_API_KEY)
    return json.load(reader(urlopen(query)))
