import json
import logging
import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms import ModelForm, inlineformset_factory, TextInput, Select, ModelChoiceField
from django.utils.encoding import python_2_unicode_compatible


LOGGER = logging.getLogger('CSN')


class LWApplication(models.Model):
    app_eui = models.CharField(max_length=16, unique=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Should match the ^[0-9a-fA-F]+$ pattern"),
                                           MinLengthValidator(16)])
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    user = models.ForeignKey(User)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


class LWApplicationForm(ModelForm):
    class Meta:
        model = LWApplication
        fields = ['app_eui', 'name', 'description']
        widgets = {
            'app_eui': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
        }


class LWCallbackURL(models.Model):
    url = models.URLField()
    application = models.ForeignKey(LWApplication, on_delete=models.CASCADE, related_name="callback_url")


LWCallbackURLFormSet = inlineformset_factory(LWApplication, LWCallbackURL, fields=('url',), can_delete=False)


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
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
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
    lw_application = models.ForeignKey(LWApplication, related_name="lw_devices")
    user = models.ForeignKey(User)

    def clean(self):
        pass
        # if self.user != self.lw_application.user:
        #     raise ValidationError("You are not authorise to add this device to the application selected")


@receiver(post_save, sender=LWDevice)
def lw_device_new_in_everynet(sender, instance, created, **kwargs):
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
def lw_device_delete_in_everynet(sender, instance, **kwargs):
    headers = \
        {
            'Authorization': settings.LW_API_KEY,
            'Content-Type': 'application/json'
        }
    requests.delete(settings.EVERYNET_API_ENDPOINT + "devices/%s" % instance.dev_eui, headers=headers)


class LWDeviceForm(ModelForm):
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user')
        super(LWDeviceForm, self).__init__(*args, **kwargs)
        self.fields['lw_application'] = ModelChoiceField(queryset=LWApplication.objects.filter(user=self.user),
                                                         widget=Select(attrs={'class': 'mdl-textfield__input'}))

    def clean(self):
        cleaned_data = super(LWDeviceForm, self).clean()
        lw_application = cleaned_data.get("lw_application")
        if self.user != lw_application.user:
            raise ValidationError("You are not authorise to add this device to the application selected")
        cleaned_data['user'] = self.user
        return cleaned_data

    def save(self, commit=True):
        lw_device = super(LWDeviceForm, self).save(commit=False)
        lw_device.user = self.user
        lw_device.save()
        return lw_device

    class Meta:
        model = LWDevice
        fields = ['name', 'description', 'dev_eui', 'dev_class', 'counters_size', 'dev_addr', 'nwkskey',
                  'lw_application']
        widgets = {
            'dev_eui': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'name': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'description': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'dev_class': Select(attrs={'class': 'mdl-textfield__input'}),
            'counters_size': Select(attrs={'class': 'mdl-textfield__input'}),
            'dev_addr': TextInput(attrs={'class': 'mdl-textfield__input'}),
            'nwkskey': TextInput(attrs={'class': 'mdl-textfield__input'}),
        }
