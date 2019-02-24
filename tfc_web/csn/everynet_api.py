import logging
import json
import requests
from collections import namedtuple
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import mail_admins, send_mail
from django.urls import reverse


LOGGER = logging.getLogger('CSN')


def everynet_add_filter(connection):
    data = {
        "tags": ["csn:"+settings.CSN_PREFIX+":user_id:"+str(connection.user.id)],
        "types": [
            "join_request",
            "uplink",
            "downlink",
            "downlink_request",
            "error",
            "warning",
            "info",
            "location"
        ]
    }
    headers = {'content-type': 'application/json'}
    response = requests.post(settings.EVERYNET_API_ENDPOINT + "filters?access_token=%s" % settings.LW_ACCESS_TOKEN,
                             data=json.dumps(data), headers=headers)
    if response.status_code not in [200, 201]:
        LOGGER.error("Everynet responded with a HTTP %s and the following error message: %s\n\nThe request was: %s" %
                     (response.status_code, response.text, json.dumps(data)))
        return False
    connection.info['filter_id'] = response.json()['filter']['id']
    connection.save()
    return True


def everynet_modify_filter(connection):
    from csn.models import Sensor
    existing_dev_ids = connection.info['devices'] if 'devices' in connection.info else []
    devices = Sensor.objects.filter(id__in=existing_dev_ids).extra(
        select={'dev_eui': "info->>'dev_eui'"}).values_list('dev_eui', flat=True)
    data = {
        "devices": list(set(devices))
    }
    headers = {'content-type': 'application/json'}
    response = requests.patch(settings.EVERYNET_API_ENDPOINT + "filters/%s?access_token=%s" %
                              (connection.info['filter_id'], settings.LW_ACCESS_TOKEN),
                              data=json.dumps(data), headers=headers)
    if response.status_code not in [200, 201]:
        LOGGER.error("Everynet responded with a HTTP %s and the following error message: %s\n\nThe request was: %s" %
                     (response.status_code, response.text, json.dumps(data)))
        return False
    return True


def everynet_remove_filter(connection):
    headers = {'content-type': 'application/json'}
    response = requests.delete(settings.EVERYNET_API_ENDPOINT + "filters/%s?access_token=%s" %
                               (connection.info['filter_id'], settings.LW_ACCESS_TOKEN), headers=headers)
    if response.status_code not in [200, 204]:
        LOGGER.error("Everynet responded with a %s status code and the following error message: %s" %
                     (response.status_code, response.text))
        return False
    return True


def send_email_everynet_add_connection(connection):
    subject = "Cambridge Sensor Network: Add a new Connection to Everynet"
    if settings.CSN_PREFIX == 'dev':
        subject = "[IGNORE - MESSAGE FROM DEV INSTANCE] " + subject
    message = "A new Connection has been created in Cambridge Sensor Network, please add a new connection in " \
              "the Everynet panel.\nThis is the parameter for the new Connection:\n%s\n\nOnce you have created " \
              "the new Connection it is necessary that you confirm this visiting %s and entering the Connection " \
              "ID of the Connection that you just created." % (json.dumps(connection.info, indent=4),
                                                               reverse('csn_connection_confirmation',
                                                                       kwargs={'connection_id': connection.id}))
    mail_admins(subject=subject, message=message)


def send_email_everynet_remove_connection(connection):
    subject = "SmartCambridge Sensor Network: Delete existing Connection to Everynet"
    if settings.CSN_PREFIX == 'dev':
        subject = "[IGNORE - MESSAGE FROM DEV INSTANCE] " + subject
    message = "The Everynet HTTP Connection with id %s has been deleted from Cambridge Sensor Network, please" \
              "delete its entry in the Everynet panel" % connection.info['connection_id']
    mail_admins(subject=subject, message=message)


def everynet_add_device(lwdevice, user_id):
    lwdev = namedtuple("LWDevice", lwdevice.keys())(*lwdevice.values())
    data = {
        "dev_eui": lwdev.dev_eui,
        "app_eui": lwdev.app_eui,
        "tags": ["csn:"+settings.CSN_PREFIX+":user_id:"+str(user_id)],
        "dev_class": lwdev.dev_class,
        "counters_size": lwdev.counters_size,
        "adr": {
            "mode": "on"
        },
        "encryption": "NS",
        "band": "EU863-870",
    }
    if settings.CSN_PREFIX == "prod":
        data['tags'] += ["smartcambridge.org"]
    if lwdev.activation_type == "otaa":
        data["activation"] = "OTAA"
        data["encryption"] = "NS"
        data["app_key"] = lwdev.app_key
    elif lwdev.activation_type == "abp":
        data["activation"] = "ABP"
        data["encryption"] = "NS"
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


def send_email_user_confirm_connection(connection):
    subject = "SmartCambridge Sensor Network: Your http connection request has been accepted"
    if settings.CSN_PREFIX == 'dev':
        subject = "[IGNORE - MESSAGE FROM DEV INSTANCE] " + subject
    message = "The HTTP Connection request with name '%s' has been approved. You can now use it." \
              % connection.info['name']
    if connection.user and connection.user.email:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [connection.user.email])
