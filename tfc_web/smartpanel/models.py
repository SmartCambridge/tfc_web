from django.contrib.auth.models import User
from django.contrib.gis.db.models import PointField, DO_NOTHING
from django.contrib.postgres.fields import JSONField
from django.db import models
from django.utils.encoding import python_2_unicode_compatible


class Layout(models.Model):
    name = models.CharField(max_length=100)
    design = JSONField()
    configuration = JSONField(null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=DO_NOTHING)
    version = models.IntegerField(default=1)
    version_date = models.DateTimeField(auto_now_add=True)

    @python_2_unicode_compatible
    def __str__(self):
        return self.name


class Display(models.Model):
    name = models.CharField(max_length=100)
    location = PointField(null=True)
    layout = models.ForeignKey(Layout, null=True)
    owner = models.ForeignKey(User, on_delete=DO_NOTHING)
