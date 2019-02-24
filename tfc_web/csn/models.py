import logging
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.forms import PointField
from django.contrib.postgres.fields import JSONField
from django.db import models
from django.contrib.gis.db import models as models_gis
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


LOGGER = logging.getLogger('CSN')


class Sensor(models.Model):
    """This is the model is used to store a json version of any type of
    sensor object."""
    id = models.AutoField(primary_key=True)
    info = JSONField()

    @classmethod
    def get_lorawan(cls, sensor_id, user_id):
        sensor = Sensor.objects.filter(info__sensor_id=sensor_id, info__sensor_type="lorawan", info__user_id=user_id)
        if sensor:
            sensor = sensor[0]
            if 'destination_id' in sensor.info and 'destination_type' in sensor.info and \
                            sensor.info['destination_type'] == "everynet_jsonrpc":
                sensor.lwapp = Destination.get_everynet_jsonrpc(user_id=user_id,
                                                                destination_id=sensor.info['destination_id'])
            else:
                sensor.lwapp = None
            return sensor
        else:
            return None

    @classmethod
    def get_all_lorawan(cls, user_id):
        return Sensor.objects.filter(info__sensor_type="lorawan", info__user_id=user_id, info__sensor_id__isnull=False)

    @classmethod
    def get_all_lorawan_with_lwapps(cls, user_id):
        sensors = Sensor.objects.filter(info__sensor_type="lorawan", info__user_id=user_id,
                                        info__sensor_id__isnull=False)
        for sensor in sensors:
            if 'destination_id' in sensor.info and 'destination_type' in sensor.info and \
                            sensor.info['destination_type'] == "everynet_jsonrpc":
                sensor.lwapp = Destination.get_everynet_jsonrpc(user_id=user_id,
                                                                destination_id=sensor.info['destination_id'])
            else:
                sensor.lwapp = None
        return sensors

    @classmethod
    def get_all_lorawan_for_destination(cls, user_id, destination_id, destination_type):
        return Sensor.objects.filter(info__destination_id=destination_id, info__destination_type=destination_type,
                                     info__user_id=user_id, info__sensor_id__isnull=False, info__sensor_type="lorawan")

    @classmethod
    def insert_lorawan(cls, info):
        return Sensor.objects.create(info=info)

    @classmethod
    def delete_lorawan(cls, sensor_id, user_id):
        sensor = Sensor.objects.filter(info__sensor_id=sensor_id, info__sensor_type="lorawan", info__user_id=user_id)
        num_deleted, deleted = sensor.delete()
        return num_deleted

    class Meta:
        managed = False


class Destination(models.Model):
    id = models.AutoField(primary_key=True)
    info = JSONField()

    @classmethod
    def get_everynet_jsonrpc(cls, destination_id, user_id):
        dest = Destination.objects.filter(info__destination_id=destination_id,
                                          info__destination_type="everynet_jsonrpc", info__user_id=user_id)
        if dest:
            return dest[0]
        else:
            return None

    @classmethod
    def get_everynet_jsonrpc_with_sensors(cls, destination_id, user_id):
        dest = Destination.objects.filter(info__destination_id=destination_id,
                                          info__destination_type="everynet_jsonrpc", info__user_id=user_id)
        if dest:
            dest[0].sensors = \
                Sensor.get_all_lorawan_for_destination(user_id=user_id, destination_id=destination_id,
                                                       destination_type="everynet_jsonrpc")
            return dest[0]
        else:
            return None

    @classmethod
    def get_all_everynet_jsonrpc(cls, user_id):
        return Destination.objects.filter(info__destination_type="everynet_jsonrpc", info__user_id=user_id,
                                          info__destination_id__isnull=False)

    @classmethod
    def insert_everynet_jsonrpc(cls, info):
        return Destination.objects.create(info=info)

    @classmethod
    def delete_everynet_jsonrpc(cls, destination_id, user_id):
        dest = Destination.objects.filter(info__destination_id=destination_id,
                                          info__destination_type="everynet_jsonrpc", info__user_id=user_id)
        # TODO May other users have sensors associated to this destination?
        sensors = Sensor.get_all_lorawan_for_destination(user_id=user_id, destination_id=destination_id,
                                                         destination_type="everynet_jsonrpc")
        for sensor in sensors:
            sensor.info.pop('destination_id', None)
            sensor.info.pop('destination_type', None)
            sensor.save()
        num_deleted, deleted = dest.delete()
        return num_deleted

    class Meta:
        managed = False


@receiver(post_save, sender=Destination)
def add_destination_api(sender, instance, created, **kwargs):
    if created:
        tfc_server_add_destination(instance)


@receiver(post_delete, sender=Destination)
def remove_destination_api(sender, instance, **kwargs):
    tfc_server_remove_destination(instance)


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
