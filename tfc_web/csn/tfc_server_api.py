import logging
import json
import requests
from tfc_web import settings


LOGGER = logging.getLogger('CSN')


def tfc_server_api_call(method, params):
    data = \
        {
            "method": method,
            "params": params
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


def tfc_server_add_sensor(sensor):
    params = {"sensor_id": sensor.sensor_id, "type": sensor.type, "info": sensor.info}
    tfc_server_api_call("add_sensor", params)


def tfc_server_add_destination(destination):
    params = {"destination_id": destination.id, "info": destination.info}
    tfc_server_api_call("add_destination", params)


def tfc_server_remove_sensor(sensor):
    params = {"sensor_id": sensor.sensor_id, "type": sensor.type}
    tfc_server_api_call("remove_sensor", params)


def tfc_server_remove_destination(destination):
    params = {"destination_id": destination.id}
    tfc_server_api_call("remove_destination", params)


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
