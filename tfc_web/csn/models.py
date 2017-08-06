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
    ACTIVATION_TYPE = (
        ('otaa', 'Over the Air Activation'),
        ('abp', 'Activation by personalisation'),
    )
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)

    # Device properties
    dev_class = models.CharField(max_length=1, choices=DEVICE_CLASS)
    counters_size = models.IntegerField(choices=COUNTERS_SIZE_OPTIONS)
    activation_type = models.CharField(max_length=5, choices=ACTIVATION_TYPE)

    #######################################
    # Activation by personalisation (ABP) #
    #######################################
    # ABP hardcodes the DevAddr as well as the security keys in the device

    # Device Address - 32 bit device address (non-unique). Dynamically generated in OTA. Fixed in ABP.
    dev_addr = models.CharField(max_length=8, null=True, blank=True,
                                validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                            MinLengthValidator(8)])
    # Network Session Key - used for interaction between the node and the network.
    # This key is used to check the validity of messages
    # Is also used to map a non-unique device address (DevAddr) to a unique DevEUI and AppEUI.
    nwkskey = models.CharField(max_length=32, null=True, blank=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                           MinLengthValidator(32)])
    # Application Session Key - used for encryption and decryption of the payload
    appskey = models.CharField(max_length=32, null=True, blank=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                           MinLengthValidator(32)])
    # appskey and nwkskey are unique per device, per session. In OTAA these keys are re-generated on every activation.
    # In ABP these keys stay the same until you change them.

    ##################################
    # Over the Air Activation (OTAA) #
    ##################################
    # Devices perform a join-procedure with the network, during which a dynamic DevAddr is assigned and security keys
    # are negotiated with the device.

    # Application Key -  used to derive the two session keys (appskey nwkskey) and during the activation procedure.
    app_key = models.CharField(max_length=32, null=True, blank=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                           MinLengthValidator(32)])

    # Device EUI - 64 bit end-device identifier, EUI-64 (unique)
    # DevEUI is assigned to the device by the chip manufacturer in LoRaWAN devices.
    # However, all communication is done using DevAddr (dynamic)
    dev_eui = models.CharField(max_length=16, unique=True,
                               validators=[RegexValidator(r"^[0-9a-fA-F]+$", "Needs to be hexadecimal"),
                                           MinLengthValidator(16)])

    # Application/Destination is linked to
    lw_application = models.ForeignKey(LWApplication, related_name="lw_devices", null=True, blank=True)
    # User that owns the device
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

    def complete_proxy_model(self):
        self.type = "LWDevice"
        self.sensor_id = self.dev_eui or self.dev_addr
        self.info = {
            'name': self.name,
            'description': self.description,
            'dev_class': self.user_id,
            'counters_size': self.counters_size,
            'activation_type': self.activation_type,
            'dev_addr': self.dev_addr,
            'nwkskey': self.nwkskey,
            'appskey': self.appskey,
            'dev_eui': self.dev_eui,
            'app_key': self.app_key,
            'destination_id': self.lw_application.id if self.lw_application else None,
            'user_id': self.user_id,
            'type': self.type
        }

    def full_clean(self, **kwargs):
        self.complete_proxy_model()
        return super(LWDevice, self).full_clean(**kwargs)

    def save(self, **kwargs):
        self.complete_proxy_model()
        return super(LWDevice, self).save(**kwargs)


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
