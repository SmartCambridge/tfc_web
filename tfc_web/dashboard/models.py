from django.contrib.postgres.fields import JSONField
from django.db import models


class Screen(models.Model):
    name = models.CharField(max_length=100)


class Layout(models.Model):
    name = models.CharField(max_length=100)
    design = JSONField()
