import logging
from django.contrib.auth.models import User
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.forms import PointField
from django.contrib.postgres.fields import JSONField
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.contrib.gis.db import models as models_gis
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible
from csn.everynet_api import everynet_add_device, everynet_remove_device
from csn.tfc_server_api import tfc_server_add_sensor, tfc_server_add_destination, tfc_server_remove_destination, \
    tfc_server_remove_sensor


LOGGER = logging.getLogger('CSN')


class Sensor(models.Model):
    sensor_id = models.CharField(max_length=255)
    # Type of sensor, for example a LoRaWAN  device
    type = models.CharField(max_length=100)
    info = JSONField()
    class Meta:
        unique_together = ("sensor_id", "type")


@receiver(post_save, sender=Sensor)
def add_sensor_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_sensor(instance)


@receiver(post_delete, sender=Sensor)
def remove_sensor_api(sender, instance, **kwargs):
    tfc_server_remove_sensor(instance)


class Destination(models.Model):
    # Type of destianation, for example a LoRaWAN application
    type = models.CharField(max_length=100)
    info = JSONField()


@receiver(post_save, sender=Destination)
def add_destination_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_destination(instance)


@receiver(post_delete, sender=Destination)
def remove_destination_api(sender, instance, **kwargs):
    tfc_server_remove_destination(instance)


class LWApplication(Destination):
    type = "LWApplication"
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

    def save(self, **kwargs):
        self.type = "LWApplication"
        self.info = {
            'name': self.name,
            'description': self.description,
            'user_id': self.user_id,
            'url': self.url,
            'type': self.type
        }
        return super(LWApplication, self).save(**kwargs)


class LWDevice(Sensor):
    """This class will store LoRaWAN devices"""
    type = "LWDevice"
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
    # Device properties
    dev_eui = models.CharField(max_length=16, unique=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                           MinLengthValidator(16)])
    dev_class = models.CharField(max_length=1, choices=DEVICE_CLASS)
    counters_size = models.IntegerField(choices=COUNTERS_SIZE_OPTIONS)
    # Activation by personalisation (ABP)
    dev_addr = models.CharField(max_length=8,
                                validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                            MinLengthValidator(8)])
    nwkskey = models.CharField(max_length=32,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
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

    def save(self, **kwargs):
        self.type = "LWDevice"
        self.sensor_id = self.dev_eui
        self.info = {
            'name': self.name,
            'description': self.description,
            'dev_eui': self.dev_eui,
            'dev_class': self.user_id,
            'counters_size': self.counters_size,
            'dev_addr': self.dev_addr,
            'nwkskey': self.nwkskey,
            'destination_id': self.lw_application.id,
            'user_id': self.user_id,
            'type': self.type
        }
        return super(LWDevice, self).save(**kwargs)


@receiver(post_save, sender=LWDevice)
def add_lw_device_api(sender, instance, created, **kwargs):
    if created:
        everynet_add_device(instance)


@receiver(post_delete, sender=LWDevice)
def remove_lw_device_api(sender, instance, **kwargs):
    everynet_remove_device(instance)


class Point4DField(GeometryField):
    geom_type = 'POINTZM'
    form_class = PointField
    description = "Point4D"

    def __init__(self, dim=4, **kwargs):
        super().__init__(dim=4, **kwargs)


class SensorData(models_gis.Model):
    """This model is used to store sensor data"""
    SENSOR_TYPE = (
        ('LWDevice', 'LoRaWAN Device'),
    )
    SOURCE_TYPE = (
        ('Everynet', 'Everynet Network'),
    )
    DATA_FORMAT = (
        ('ascii_hex', 'ascii_hex'),
        ('ascii', 'ascii'),
        ('binary', 'binary'),
        ('other', 'other'),
    )
    timestamp = models.DateTimeField()
    location_4d = Point4DField(geography=True)
    sensor_id = models.CharField(max_length=255)
    sensor_type = models.CharField(choices=SENSOR_TYPE, max_length=100)
    source_type = models.CharField(choices=SOURCE_TYPE, max_length=100)
    data_format = models.CharField(choices=DATA_FORMAT, max_length=100)
    data = JSONField()
