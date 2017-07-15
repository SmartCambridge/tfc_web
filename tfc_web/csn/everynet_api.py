import logging
import json
import requests
from django.conf import settings


LOGGER = logging.getLogger('CSN')


def everynet_add_device(lwdev):
    data = \
        {
            "app_eui": settings.LW_APP_EUI,
            "dev_eui": lwdev.dev_eui,
            "appskey": settings.LW_APP_API_KEY,
            "dev_class": lwdev.dev_class,
            "counters_size": lwdev.counters_size,
            "activation_type": "abp_core",
            "band": "EU863-870",
            "dev_addr": lwdev.dev_addr,
            "nwkskey": lwdev.nwkskey
        }
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    response = requests.post(settings.EVERYNET_API_ENDPOINT + "devices", data=json.dumps(data), headers=headers)
    if response.status_code != 200:
        LOGGER.error(response)


def everynet_remove_device(lwdev):
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    requests.delete(settings.EVERYNET_API_ENDPOINT + "devices/%s" % lwdev.dev_eui, headers=headers)
