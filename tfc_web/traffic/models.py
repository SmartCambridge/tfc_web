from django.db import models


class ANPRCamera(models.Model):
    id = models.CharField(primary_key=True, max_length=10)
    units = models.IntegerField()
    description = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()


class Trip(models.Model):
    entry_time = models.DateTimeField()
    entry_lane = models.IntegerField()
    entry_direction = models.IntegerField()
    entry_camera_id = models.CharField(max_length=10)
    entry_absolute_direction = models.CharField(max_length=10)
    plate_encoded = models.CharField(max_length=255)
    plate_country = models.CharField(max_length=10)
    confidence = models.IntegerField()
    exit_time = models.DateTimeField()
    exit_lane = models.IntegerField()
    exit_direction = models.IntegerField()
    exit_camera_id = models.CharField(max_length=10)
    exit_absolute_direction = models.CharField(max_length=10)
    journey_time = models.DurationField()


class TripChain(models.Model):
    camera_id = models.CharField(max_length=10)
    entry_time = models.DateTimeField()
    vehicle_class = models.CharField(max_length=100)
    total_trip_time = models.DurationField()
    # The whole chain of movements
    chain_vector = models.CharField(max_length=600)
    # Chain vector with time (does not include initial camera)
    chain_vector_time = models.CharField(max_length=600)

    class Meta:
        indexes = [
            models.Index(fields=['camera_id', 'entry_time', 'total_trip_time', 'chain_vector']),
            models.Index(fields=['camera_id']),
            models.Index(fields=['entry_time']),
            models.Index(fields=['chain_vector']),
            models.Index(fields=['chain_vector_time']),
        ]
