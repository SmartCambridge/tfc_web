import logging
from django.contrib.auth.models import User
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.forms import PointField
from django.contrib.postgres.fields import JSONField
from django.core.validators import RegexValidator, MinLengthValidator
from django.db import models
from django.contrib.gis.db import models as models_gis
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils.encoding import python_2_unicode_compatible
from csn.tfc_server_api import tfc_server_add_sensor, tfc_server_add_destination, tfc_server_remove_destination, \
    tfc_server_remove_sensor


LOGGER = logging.getLogger('CSN')


class Sensor(models.Model):
    '''This is the model in the tfcserver database that is used to store a json version of any type of
    sensor object.'''
    id = models.AutoField(primary_key=True)
    info = JSONField()

    class Meta:
        managed = False


@receiver(post_save, sender=Sensor)
def add_sensor_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_sensor(instance)


@receiver(post_delete, sender=Sensor)
def remove_sensor_api(sender, instance, **kwargs):
    tfc_server_remove_sensor(instance)


class Destination(models.Model):
    id = models.AutoField(primary_key=True)
    info = JSONField()

    class Meta:
        managed = False


@receiver(post_save, sender=Destination)
def add_destination_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_destination(instance)


@receiver(post_delete, sender=Destination)
def remove_destination_api(sender, instance, **kwargs):
    tfc_server_remove_destination(instance)


class LWApplication(models.Model):
    '''Model used to store LoRaWAN applications. These are a type of "Destination" object in the tfcserver database.
    This should be a child of Destination model (inheriatnce) but because they sit in different database, the
    relationship is manual via destination_id, which is the id of the object created in the Destination table
    that represent this objects in json format.'''
    destination_id = models.IntegerField()
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    user = models.ForeignKey(User, related_name="lwapplications")
    url = models.URLField()
    token = models.CharField(max_length=255, null=True, blank=True)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name

    def save(self, **kwargs):
        info = {
            'name': self.name,
            'description': self.description,
            'user_id': self.user.id,
            'url': self.url,
            'destination_id': self.url,
            'http_token': self.token,
            'destination_type': "LWApplication"
        }
        existing = Destination.objects.filter(info__destination_type="LWApplication", info__destination_id=self.url)
        if existing:
            if self.destination_id is None:
                LOGGER.error("Inconsistency error, found Destination entry with id %s and content %s in tfcserver, "
                             "that didn't exist in the local database. Trying to insert: %s" %
                             (existing.id, existing.info, info))
            if len(existing) > 1:
                LOGGER.error("More than one entry for LWapplicationa and destination_id '%s' in Destination"
                             "in tfcserver" % self.url)
            if self.destination_id not in [destination.id for destination in existing]:
                LOGGER.error("Current entry in local database with id %s was expecting entry in Destination table "
                             "with id %s in tfcserver." % (self.id, self.destination_id))
            existing.update(info=info)
        else:
            if self.destination_id:
                LOGGER.error("Inconsistency error, existing entry in LWApplication with id %s was expecting "
                             "and entry with id %s in Destination table in tfcserver. Trying to insert: %s" %
                             (self.id, self.destination_id, info))
            self.destination_id = Destination.objects.create(info=info).id
        return super(LWApplication, self).save(**kwargs)


@receiver(post_delete, sender=LWApplication)
def remove_lwapp_from_destination(sender, instance, **kwargs):
    existing = Destination.objects.filter(info__destination_type="LWApplication", info__destination_id=instance.url)
    if instance.destination_id and not existing:
        LOGGER.error("Inconsistency error, not found LWApplication with destination_id %s in Destination table."
                     "Was expecting id %s" % (instance.url, instance.destination_id))
    elif len(existing) > 1:
        LOGGER.error("More than one entry for LWapplicationa and destination_id '%s' in Destination"
                     "in tfcserver db." % instance.url)
    elif instance.destination_id and instance.destination_id not in [destination.id for destination in existing]:
        LOGGER.error("Current entry LWApplication with destination_id %s was expecting entry in Destination table "
                     "with id %s in tfcserver. Not found." % (instance.url, instance.destination_id))
    elif not instance.destination_id and existing:
        LOGGER.error("Inconsistency error, not expecting LWApplication with destination_id %s in Destination table."
                     % instance.url)
    else:
        existing.delete()


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
    ACTIVATION_TYPE = (
        ('otaa', 'Over the Air Activation'),
        ('abp', 'Activation by personalisation'),
    )
    sensor_id = models.IntegerField()

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
    user = models.ForeignKey(User, related_name="lwdevices")

    def clean(self):
        pass
        # if self.user != self.lw_application.user:
        #     raise ValidationError("You are not authorise to add this device to the application selected")

    def save(self, **kwargs):
        info = {
            'sensor_id': self.dev_eui,
            'sensor_type': "LWDevice",
            'name': self.name,
            'description': self.description,
            'dev_class': self.dev_class,
            'counters_size': self.counters_size,
            'activation_type': self.activation_type,
            'dev_addr': self.dev_addr,
            'nwkskey': self.nwkskey,
            'appskey': self.appskey,
            'dev_eui': self.dev_eui,
            'app_key': self.app_key,
            'destination_id': self.lw_application.id if self.lw_application else None,
            'destination_type': "LWApplication",
            'user_id': self.user.id
        }
        existing = Sensor.objects.filter(info__sensor_type="LWDevice", info__sensor_id=self.dev_eui)
        if existing:
            if self.sensor_id is None:
                LOGGER.error("Inconsistency error, found Sensor entry with id %s and content %s in tfcserver, "
                             "that didn't exist in the local database. Trying to insert: %s" %
                             (existing.id, existing.info, info))
            if len(existing) > 1:
                LOGGER.error("More than one entry for LWSensor and sensor_id '%s' in Sensor"
                             "in tfcserver" % self.dev_eui)
            if self.sensor_id not in [sensor.id for sensor in existing]:
                LOGGER.error("Current entry in local database with id %s was expecting entry in Sensor table "
                             "with id %s in tfcserver." % (self.id, self.sensor_id))
            existing.update(info=info)
        else:
            if self.sensor_id:
                LOGGER.error("Inconsistency error, existing entry in LWSensor with id %s was expecting "
                             "an entry with id %s in Sensor table in tfcserver. Trying to insert: %s" %
                             (self.id, self.sensor_id, info))
            self.sensor_id = Sensor.objects.create(info=info).id
        try:
            return super(LWDevice, self).save(**kwargs)
        except Exception as e:
            Sensor.objects.filter(id=self.sensor_id).delete()
            raise e


@receiver(post_delete, sender=LWDevice)
def remove_lwdevice_from_sensor(sender, instance, **kwargs):
    existing = Sensor.objects.filter(info__sensor_type="LWDevice", info__sensor_id=instance.dev_eui)
    if instance.sensor_id and not existing:
        LOGGER.error("Inconsistency error, not found LWDevice with sensor_id %s in Sensor table."
                     "Was expecting id %s" % (instance.dev_eui, instance.sensor_id))
    elif len(existing) > 1:
        LOGGER.error("More than one entry for LWDevice and sensor_id '%s' in Sensor"
                     "in tfcserver db." % instance.dev_eui)
    elif instance.sensor_id and instance.sensor_id not in [sensor.id for sensor in existing]:
        LOGGER.error("Current entry LWDevice with sensor_id %s was expecting entry in Sensor table "
                     "with id %s in tfcserver. Not found." % (instance.dev_eui, instance.sensor_id))
    elif not instance.sensor_id and existing:
        LOGGER.error("Inconsistency error, not expecting LWDevice with sensor_id %s in Sensor table."
                     % instance.dev_eui)
    else:
        existing.delete()


class Point4DField(GeometryField):
    geom_type = 'POINTZM'
    form_class = PointField
    description = "Point4D"

    def __init__(self, dim=4, **kwargs):
        super().__init__(dim=4, **kwargs)


class SensorData(models_gis.Model):
    """This model is used to store sensor data"""
    id = models.AutoField(primary_key=True)
    timestamp = models.DateTimeField()
    location_4d = Point4DField(geography=True)
    info = JSONField()

    class Meta:
        managed = False


# class SensorData(models_gis.Model):
#     """This model is used to store sensor data"""
#     SENSOR_TYPE = (
#         ('LWDevice', 'LoRaWAN Device'),
#     )
#     SOURCE_TYPE = (
#         ('Everynet', 'Everynet Network'),
#     )
#     DATA_FORMAT = (
#         ('ascii_hex', 'ascii_hex'),
#         ('ascii', 'ascii'),
#         ('binary', 'binary'),
#         ('other', 'other'),
#     )
#     timestamp = models.DateTimeField()
#     location_4d = Point4DField(geography=True)
#     sensor_id = models.CharField(max_length=255)
#     sensor_type = models.CharField(choices=SENSOR_TYPE, max_length=100)
#     source_type = models.CharField(choices=SOURCE_TYPE, max_length=100)
#     data_format = models.CharField(choices=DATA_FORMAT, max_length=100)
#     data = JSONField()
