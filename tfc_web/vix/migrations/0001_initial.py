# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Agency',
            fields=[
                ('id', models.CharField(primary_key=True, max_length=10, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('url', models.URLField()),
            ],
        ),
        migrations.CreateModel(
            name='Calendar',
            fields=[
                ('id', models.AutoField(verbose_name='ID', auto_created=True, primary_key=True, serialize=False)),
                ('service_id', models.IntegerField()),
                ('monday', models.BooleanField()),
                ('tuesday', models.BooleanField()),
                ('wednesday', models.BooleanField()),
                ('thursday', models.BooleanField()),
                ('friday', models.BooleanField()),
                ('saturday', models.BooleanField()),
                ('sunday', models.BooleanField()),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
            ],
        ),
        migrations.CreateModel(
            name='Route',
            fields=[
                ('id', models.CharField(primary_key=True, max_length=20, serialize=False)),
                ('short_name', models.CharField(max_length=10)),
                ('long_name', models.CharField(max_length=200)),
                ('type', models.IntegerField()),
                ('agency', models.ForeignKey(to='vix.Agency')),
            ],
        ),
        migrations.CreateModel(
            name='Stop',
            fields=[
                ('id', models.IntegerField(primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=8)),
                ('name', models.CharField(max_length=200)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
            ],
        ),
        migrations.CreateModel(
            name='StopTime',
            fields=[
                ('id', models.AutoField(verbose_name='ID', auto_created=True, primary_key=True, serialize=False)),
                ('arrival_time', models.TimeField()),
                ('departure_time', models.TimeField()),
                ('sequence', models.IntegerField()),
                ('stop_headsign', models.CharField(max_length=200)),
                ('stop', models.ForeignKey(to='vix.Stop')),
            ],
        ),
        migrations.CreateModel(
            name='Trip',
            fields=[
                ('id', models.CharField(primary_key=True, max_length=100, serialize=False)),
                ('service_id', models.IntegerField()),
                ('headsign', models.CharField(max_length=250)),
                ('short_name', models.CharField(max_length=50)),
                ('direction', models.IntegerField()),
                ('route', models.ForeignKey(to='vix.Route')),
            ],
        ),
        migrations.AddField(
            model_name='stoptime',
            name='trip',
            field=models.ForeignKey(to='vix.Trip'),
        ),
    ]
