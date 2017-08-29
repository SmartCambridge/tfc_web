import logging
import json
import requests
from django.conf import settings


LOGGER = logging.getLogger('CSN')


def everynet_add_device(lwdev):
    if lwdev.activation_type == "otaa":
        data = \
            {
                "app_eui": settings.LW_APP_EUI,
                "dev_eui": lwdev.dev_eui,
                "app_key": lwdev.app_key,
                "dev_class": lwdev.dev_class,
                "counters_size": lwdev.counters_size,
                "activation_type": "overair_core",
                "band": "EU863-870",
            }
    elif lwdev.activation_type == "abp":
        data = \
            {
                "app_eui": settings.LW_APP_EUI,
                "dev_eui": lwdev.dev_eui,
                "dev_class": lwdev.dev_class,
                "counters_size": lwdev.counters_size,
                "activation_type": "abp_core",
                "band": "EU863-870",
                "dev_addr": lwdev.dev_addr,
                "nwkskey": lwdev.nwkskey,
                "appskey": lwdev.appskey
            }
    else:
        lwdev.error_message = "Activation type %s not supported for LoRaWAN device with id %s", \
                              (lwdev.activation_type, lwdev.id)
        LOGGER.error(lwdev.error_message)
        return False
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    response = requests.post(settings.EVERYNET_API_ENDPOINT + "devices", data=json.dumps(data), headers=headers)
    if response.status_code != 200:
        LOGGER.error("Everynet responded with a HTTP %s and the following error message: %s" %
                     (response.status_code, response.text))
        lwdev.error_message = response.json()['message']
        return False
    return True


def everynet_remove_device(lwdev):
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    response = requests.delete(settings.EVERYNET_API_ENDPOINT + "devices/%s" % lwdev.info.dev_eui, headers=headers)
    if response.status_code != 200:
        LOGGER.error("Everynet responded with a %s status code and the following error message: %s" %
                     (response.status_code, response.text))
        lwdev.error_message = response.json()['message']
        return False
    return True
