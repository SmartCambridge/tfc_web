
from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import APIException
import json
import logging
import os

# Path to the data store
DATA_PATH = settings.DATA_PATH

logger = logging.getLogger(__name__)


class TFCValidationError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Invalid input'
    default_code = 'invalid'


def safe_build(path):
    '''
    Build a pathname from DATA_PATH and path, checking that the
    result is still somewhere within DATA_PATH, allowing for directory
    traversal attempts and symlinks pointing outside DATA_PATH
    '''
    result = os.path.realpath(os.path.join(DATA_PATH, path))
    if result.startswith(os.path.join(DATA_PATH, '')):
        return result
    logger.warning('Requested file outside DATA_PATH: path "{0}", result "{1}"'
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
        logger.info('Failed to parse "{0}"'.format(filename))
        raise
    except (FileNotFoundError):
        logger.info('Failed to open "{0}"'.format(filename))
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
        logger.info('Failed to parse "{0}" from "{1}"'
                    .format(line, filename))
        raise
    except (FileNotFoundError):
        logger.info('Failed to open "{0}"'.format(filename))
        raise
    return results


def get_config(type, id=None, key=None, fieldname=None):
    '''
    Get the config for a metric 'type'. If 'id' is None, return the
    entire config. Otherwise return just the config  with identifier 'id'
    in field 'fieldname' within a list keyed by 'key'.

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
        if config.get(fieldname) == id:
            return config
    logger.info('Config type {0} for "{1}" not found'.format(type, id))
    raise TFCValidationError('Bad ID "{0}"'.format(id))
