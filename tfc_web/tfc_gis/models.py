from django.contrib.gis.db import models


class Area(models.Model):
    name = models.CharField(max_length=100)
    poly = models.PolygonField()
    objects = models.GeoManager()
    image = models.ImageField()
