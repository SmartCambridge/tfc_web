from django.db import models


class Agency(models.Model):
    id = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=200)
    url = models.URLField()


class Route(models.Model):
    id = models.CharField(max_length=20, primary_key=True)
    agency = models.ForeignKey(Agency, to_field='id')
    short_name = models.CharField(max_length=10)
    long_name = models.CharField(max_length=200)
    type = models.IntegerField()


class Stop(models.Model):
    id = models.IntegerField(primary_key=True)
    code = models.CharField(max_length=8)
    name = models.CharField(max_length=200)
    latitude = models.FloatField()
    longitude = models.FloatField()


class Trip(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    route = models.ForeignKey(Route, to_field='id')
    service_id = models.IntegerField()
    headsign = models.CharField(max_length=250)
    short_name = models.CharField(max_length=50)
    direction = models.IntegerField()


class StopTime(models.Model):
    trip = models.ForeignKey(Trip, to_field='id')
    arrival_time = models.TimeField()
    departure_time = models.TimeField()
    stop = models.ForeignKey(Stop, to_field='id')
    sequence = models.IntegerField()
    stop_headsign = models.CharField(max_length=200)


class Calendar(models.Model):
    service_id = models.IntegerField()
    monday = models.BooleanField()
    tuesday = models.BooleanField()
    wednesday = models.BooleanField()
    thursday = models.BooleanField()
    friday = models.BooleanField()
    saturday = models.BooleanField()
    sunday = models.BooleanField()
    start_date = models.DateField()
    end_date = models.DateField()
