import logging
import json
import requests
from collections import namedtuple
from django.conf import settings


LOGGER = logging.getLogger('CSN')


def everynet_add_device(lwdevice):
    lwdev = namedtuple("LWDevice", lwdevice.keys())(*lwdevice.values())
    data = {
        "dev_eui": lwdev.dev_eui,
        "app_eui": settings.LW_APP_EUI,
        "tags": ["smartcambridge.org"],
        "dev_class": lwdev.dev_class,
        "counters_size": lwdev.counters_size,
        "adr": {
            "mode": "on"
        },
        "band": "EU863-870",
        "encryption": "NS"
    }
    if lwdev.activation_type == "otaa":
        data["activation"] = "OTAA"
        data["app_key"] = lwdev.app_key
    elif lwdev.activation_type == "abp":
        data["activation"] = "ABP"
        data["dev_addr"] = lwdev.dev_addr
        data["nwkskey"] = lwdev.nwkskey
        data["appskey"] = lwdev.appskey
    else:
        lwdevice['error_message'] = "Activation type %s not supported for LoRaWAN device with id %s", \
                                    (lwdev.activation_type, lwdev.id)
        LOGGER.error(lwdevice['error_message'])
        return False
    headers = {'content-type': 'application/json'}
    response = requests.post(settings.EVERYNET_API_ENDPOINT + "devices?access_token=%s" % settings.LW_ACCESS_TOKEN,
                             data=json.dumps(data), headers=headers)
    if response.status_code not in [200, 201]:
        LOGGER.error("Everynet responded with a HTTP %s and the following error message: %s" %
                     (response.status_code, response.text))
        LOGGER.error(json.dumps(data))
        lwdevice['error_message'] = response.json()['message']
        return False
    return True


def everynet_remove_device(lwdev):
    headers = {'content-type': 'application/json'}
    response = requests.delete(settings.EVERYNET_API_ENDPOINT + "devices/%s?access_token=%s" %
                               (lwdev.info['dev_eui'], settings.LW_ACCESS_TOKEN), headers=headers)
    if response.status_code not in [200, 204]:
        LOGGER.error("Everynet responded with a %s status code and the following error message: %s" %
                     (response.status_code, response.text))
        lwdev.error_message = response.json()['message']
        return False
    return True
