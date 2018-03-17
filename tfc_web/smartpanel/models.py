from django.contrib.gis.db.models import PointField
from django.contrib.postgres.fields import JSONField
from django.db import models
from django.utils.encoding import python_2_unicode_compatible


class Layout(models.Model):
    name = models.CharField(max_length=100)
    design = JSONField()
    configuration = JSONField(null=True, blank=True)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


class Screen(models.Model):
    name = models.CharField(max_length=100)
    location = PointField(null=True)
    layout = models.ForeignKey(Layout, null=True)
