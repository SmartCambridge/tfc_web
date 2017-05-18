import json

import logging
import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms import ModelForm, inlineformset_factory


LOGGER = logging.getLogger('CSN')


class LWDevice(models.Model):
    """This class will store LoRaWAN devices"""
    DEVICE_CLASS = (
        ('A', 'A'),
        ('C', 'C'),
    )
    COUNTERS_SIZE_OPTIONS = (
        (2, 2),
        (4, 4),
    )
    dev_eui = models.CharField(max_length=16, unique=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Should match the ^[0-9a-fA-F]+$ pattern"),
                                           MinLengthValidator(16)])
    dev_class = models.CharField(max_length=1, choices=DEVICE_CLASS)
    counters_size = models.IntegerField(choices=COUNTERS_SIZE_OPTIONS)
    dev_addr = models.CharField(max_length=8,
                                validators=[RegexValidator(r"^[0-9a-fA-F]+$",
                                                           "Should match the ^[0-9a-fA-F]+$ pattern"),
                                            MinLengthValidator(8)])
    nwkskey = models.CharField(max_length=32,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Should match the ^[0-9a-fA-F]+$ pattern"),
                                           MinLengthValidator(32)])
    user = models.ForeignKey(User)
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)


@receiver(post_save, sender=LWDevice)
def send_to_everynet(sender, instance, created, **kwargs):
    if created:
        data = \
            {
                "app_eui": settings.LW_APP_EUI,
                "dev_eui": instance.dev_eui,
                "appskey": settings.LW_APP_API_KEY,
                "dev_class": instance.dev_class,
                "counters_size": instance.counters_size,
                "activation_type": "abp_core",
                "band": "EU863-870",
                "dev_addr": instance.dev_addr,
                "nwkskey": instance.nwkskey
            }
        headers = \
            {
                'Authorization': settings.LW_API_KEY,
                'Content-Type': 'application/json'
            }
        response = requests.post(settings.EVERYNET_API_ENDPOINT + "devices", data=json.dumps(data), headers=headers)
        if response.status_code != 200:
            LOGGER.error(response)


@receiver(post_delete, sender=LWDevice)
def send_to_everynet(sender, instance, **kwargs):
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    requests.delete(settings.EVERYNET_API_ENDPOINT + "devices/%s" % instance.dev_eui, headers=headers)


class LWDeviceForm(ModelForm):
    class Meta:
        model = LWDevice
        fields = ['name', 'description', 'dev_eui', 'dev_class', 'counters_size', 'dev_addr', 'nwkskey']


class LWApplication(models.Model):
    app_eui = models.CharField(max_length=16, unique=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Should match the ^[0-9a-fA-F]+$ pattern"),
                                           MinLengthValidator(16)])
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    user = models.ForeignKey(User)


class LWApplicationForm(ModelForm):
    class Meta:
        model = LWApplication
        fields = ['app_eui', 'name', 'description']


class LWCallbackURL(models.Model):
    url = models.URLField()
    application = models.ForeignKey(LWApplication, on_delete=models.CASCADE, related_name="callback_url")


LWCallbackURLFormSet = inlineformset_factory(LWApplication, LWCallbackURL, fields=('url',), can_delete=False)
