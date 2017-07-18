import logging
import json
import requests
from tfc_web import settings
from urllib.parse import urlparse


LOGGER = logging.getLogger('CSN')


def tfc_server_add_device(lwdev):
    data = \
        {
            "msg_type": "module_method",
            "to_module_name": "msgrouter",
            "to_module_id": "test",
            "method": "add_device",
            "params": {
                "dev_eui": lwdev.dev_eui,
                "app_eui": lwdev.lw_application.id
            }
        }
    headers = \
        {
            'X-Auth-Token': settings.TFC_SERVER_CSN_TOKEN,
            'Content-Type': 'application/json'
        }
    try:
        response = requests.post(settings.TFC_SERVER_CSN_API, data=json.dumps(data), headers=headers)
        if response.status_code != 200:
            LOGGER.error(response)
    except Exception as e:
        LOGGER.error(e)


def tfc_server_add_application(lwapp):
    appurl = urlparse(lwapp.url)
    data = \
        {
            "msg_type": "module_method",
            "to_module_name": "msgrouter",
            "to_module_id": "test",
            "method": "add_application",
            "params": {
                "app_eui": lwapp.id,
                "http.post": True,
                "http.host": appurl.hostname,
                "http.port": appurl.port if appurl.port else 80,
                "http.uri": appurl.path,
                "http.ssl": True if appurl.scheme == 'https' else False,
                "http.token": ""
            }
        }
    headers = \
        {
            'X-Auth-Token': settings.TFC_SERVER_CSN_TOKEN,
            'Content-Type': 'application/json'
        }
    try:
        response = requests.post(settings.TFC_SERVER_CSN_API, data=json.dumps(data), headers=headers)
        if response.status_code != 200:
            LOGGER.error(response)
    except Exception as e:
        LOGGER.error(e)


def tfc_server_remove_device(lwdev):
    data = \
        {
            "msg_type": "module_method",
            "to_module_name": "msgrouter",
            "to_module_id": "test",
            "method": "remove_device",
            "params": {"dev_eui": lwdev.dev_eui}
        }
    headers = \
        {
            'X-Auth-Token': settings.TFC_SERVER_CSN_TOKEN,
            'Content-Type': 'application/json'
        }
    try:
        response = requests.post(settings.TFC_SERVER_CSN_API, data=json.dumps(data), headers=headers)
        if response.status_code != 200:
            LOGGER.error(response)
    except Exception as e:
        LOGGER.error(e)


def tfc_server_remove_application(lwapp):
    data = \
        {
            "msg_type": "module_method",
            "to_module_name": "msgrouter",
            "to_module_id": "test",
            "method": "remove_application",
            "params": {"app_eui": lwapp.id}
        }
    headers = \
        {
            'X-Auth-Token': settings.TFC_SERVER_CSN_TOKEN,
            'Content-Type': 'application/json'
        }
    try:
        response = requests.post(settings.TFC_SERVER_CSN_API, data=json.dumps(data), headers=headers)
        if response.status_code != 200:
            LOGGER.error(response)
    except Exception as e:
        LOGGER.error(e)


def tfc_server_forward_application():
    """
    {
       "msg_type":    "module_method",
       "to_module_name": "msgrouter",
       "to_module_id": "test",
       "method": "forward_application",
       "params": { "app_eui": "ff18b2000000abcd",
                   "to_app_euis": [ "ff18b2000000abcd",
                                    "ff18b20000001234",
                                    "ff18b20000005678"
                                  ]
                 }
    }
    """
    # TODO Impletement
    pass
