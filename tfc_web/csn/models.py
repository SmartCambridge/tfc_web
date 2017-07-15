import logging
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible
from csn.everynet_api import everynet_add_device, everynet_remove_device
from csn.tfc_server_api import tfc_server_add_device, tfc_server_add_application, tfc_server_remove_application, \
    tfc_server_remove_device


LOGGER = logging.getLogger('CSN')


class LWApplication(models.Model):
    # app_eui = models.CharField(max_length=16, unique=True,
    #                            validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Should match the ^[0-9a-fA-F]+$ pattern"),
    #                                        MinLengthValidator(16)])
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    user_id = models.IntegerField()
    url = models.URLField()

    @property
    def user(self):
        return User.objects.get(pk=self.user_id)

    @user.setter
    def user(self, object):
        if object.__class__ == User and object.pk is not None:
            self.user_id = object.pk
        else:
            raise ValidationError("user needs to be a django User")

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


@receiver(post_save, sender=LWApplication)
def add_lw_application_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_application(instance)


@receiver(post_delete, sender=LWApplication)
def remove_lw_application_api(sender, instance, **kwargs):
    tfc_server_remove_application(instance)


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
    user_id = models.IntegerField()

    def clean(self):
        pass
        # if self.user != self.lw_application.user:
        #     raise ValidationError("You are not authorise to add this device to the application selected")

    @property
    def user(self):
        return User.objects.get(pk=self.user_id)

    @user.setter
    def user(self, object):
        if object.__class__ == User and object.pk is not None:
            self.user_id = object.pk
        else:
            raise ValidationError("user needs to be a django User")


@receiver(post_save, sender=LWDevice)
def add_lw_device_api(sender, instance, created, **kwargs):
    if created:
        everynet_add_device(instance)
        tfc_server_add_device(instance)


@receiver(post_delete, sender=LWDevice)
def remove_lw_device_api(sender, instance, **kwargs):
    everynet_remove_device(instance)
    tfc_server_remove_device(instance)
