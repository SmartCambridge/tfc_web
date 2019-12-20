from django.contrib.gis.db import models
from django.contrib.postgres.fields import JSONField


class Bike(models.Model):
    bike_id = models.CharField(max_length=200, db_index=True)
    BIKE_COMPANIES = (
        ('ofo', 'ofo'),
        ('mobike', 'mobike'),
    )
    company = models.CharField(choices=BIKE_COMPANIES, max_length=20)
    lng = models.FloatField()
    lat = models.FloatField()
    gis_location = models.PointField(db_index=True)
    timestamp = models.DateTimeField(db_index=True, auto_now_add=True)
    data = JSONField()
