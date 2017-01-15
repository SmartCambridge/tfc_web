# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('realtime', '0002_auto_20161113_1550'),
    ]

    operations = [
        migrations.CreateModel(
            name='BusJourney',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('departure_time', models.CharField(max_length=20)),
            ],
        ),
        migrations.CreateModel(
            name='BusJourneyPattern',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('direction', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='BusJourneyPatternSection',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('stops_list', models.TextField()),
            ],
        ),
        migrations.CreateModel(
            name='BusLine',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('line_name', models.CharField(max_length=255)),
                ('description', models.CharField(max_length=255)),
                ('standard_origin', models.CharField(max_length=255)),
                ('standard_destination', models.CharField(max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='BusOperator',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('code', models.CharField(max_length=255)),
                ('short_name', models.CharField(max_length=255)),
                ('trading_name', models.CharField(max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='BusRoute',
            fields=[
                ('id', models.CharField(serialize=False, primary_key=True, max_length=255)),
                ('description', models.CharField(max_length=255)),
                ('stops_list', models.TextField()),
                ('line', models.ForeignKey(related_name='routes', to='realtime.BusLine')),
            ],
        ),
        migrations.AddField(
            model_name='busline',
            name='operator',
            field=models.ForeignKey(related_name='lines', to='realtime.BusOperator'),
        ),
        migrations.AddField(
            model_name='busjourneypatternsection',
            name='line',
            field=models.ForeignKey(related_name='journey_sections', to='realtime.BusLine'),
        ),
        migrations.AddField(
            model_name='busjourneypattern',
            name='route',
            field=models.ForeignKey(related_name='journey_patterns', to='realtime.BusRoute'),
        ),
        migrations.AddField(
            model_name='busjourneypattern',
            name='section',
            field=models.ForeignKey(related_name='journey_patterns', to='realtime.BusJourneyPatternSection'),
        ),
        migrations.AddField(
            model_name='busjourney',
            name='line',
            field=models.ForeignKey(related_name='journeys', to='realtime.BusLine'),
        ),
        migrations.AddField(
            model_name='busjourney',
            name='pattern',
            field=models.ForeignKey(related_name='journeys', to='realtime.BusJourneyPattern'),
        ),
    ]
