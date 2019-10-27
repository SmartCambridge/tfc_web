# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import django
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0003_auto_20170115_2238'),
    ]

    operations = [
        migrations.CreateModel(
            name='JourneyPattern',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
                ('direction', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='JourneyPatternSection',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
            ],
        ),
        migrations.CreateModel(
            name='JourneyPatternTimingLink',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
                ('stop_from_timing_status', models.CharField(max_length=3)),
                ('stop_from_sequence_number', models.IntegerField()),
                ('stop_to_timing_status', models.CharField(max_length=3)),
                ('stop_to_sequence_number', models.IntegerField()),
                ('run_time', models.DurationField()),
                ('wait_time', models.DurationField(blank=True, null=True)),
                ('journey_pattern_section',
                 models.ForeignKey(to='transport.JourneyPatternSection', related_name='timing_link',
                                   on_delete=django.db.models.deletion.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='Line',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
                ('line_name', models.CharField(max_length=255)),
                ('description', models.CharField(max_length=255)),
                ('standard_origin', models.CharField(max_length=255)),
                ('standard_destination', models.CharField(max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='Route',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
                ('description', models.CharField(max_length=255)),
                ('stops_list', models.TextField()),
                ('line', models.ForeignKey(to='transport.Line', related_name='routes',
                                           on_delete=django.db.models.deletion.CASCADE)),
            ],
        ),
        migrations.CreateModel(
            name='Stop',
            fields=[
                ('id', models.AutoField(auto_created=True, serialize=False, verbose_name='ID', primary_key=True)),
                ('atco_code', models.CharField(unique=True, max_length=12)),
                ('naptan_code', models.CharField(max_length=8)),
                ('plate_code', models.CharField(max_length=10)),
                ('cleardown_code', models.CharField(max_length=10)),
                ('common_name', models.CharField(max_length=64)),
                ('common_name_lang', models.CharField(max_length=2)),
                ('short_common_name', models.CharField(max_length=21)),
                ('short_common_name_lang', models.CharField(max_length=2)),
                ('landmark', models.CharField(max_length=64)),
                ('landmark_lang', models.CharField(max_length=2)),
                ('street', models.CharField(max_length=64)),
                ('street_lang', models.CharField(max_length=2)),
                ('crossing', models.CharField(max_length=64)),
                ('crossing_lang', models.CharField(max_length=2)),
                ('indicator', models.CharField(max_length=64)),
                ('indicator_lang', models.CharField(max_length=2)),
                ('bearing', models.CharField(max_length=2)),
                ('nptg_locality_code', models.CharField(max_length=8)),
                ('locality_name', models.CharField(max_length=64)),
                ('parent_locality_name', models.CharField(max_length=64)),
                ('grand_parent_locality_name', models.CharField(max_length=64)),
                ('town', models.CharField(max_length=64)),
                ('town_lang', models.CharField(max_length=2)),
                ('suburb', models.CharField(max_length=64)),
                ('suburb_lang', models.CharField(max_length=2)),
                ('locality_centre', models.BooleanField()),
                ('grid_type', models.CharField(max_length=1)),
                ('easting', models.IntegerField()),
                ('northing', models.IntegerField()),
                ('longitude', models.FloatField()),
                ('latitude', models.FloatField()),
                ('stop_type', models.CharField(max_length=3)),
                ('bus_stop_type', models.CharField(max_length=3)),
                ('timing_status', models.CharField(max_length=3)),
                ('default_wait_time', models.IntegerField(blank=True, null=True)),
                ('notes', models.CharField(max_length=255)),
                ('notes_lang', models.CharField(max_length=2)),
                ('administrative_area_code', models.IntegerField()),
                ('creation_datetime', models.DateTimeField()),
                ('modification_datetime', models.DateTimeField()),
                ('revision_number', models.IntegerField()),
                ('modification', models.CharField(max_length=3)),
                ('status', models.CharField(max_length=3)),
            ],
        ),
        migrations.CreateModel(
            name='VehicleJourney',
            fields=[
                ('id', models.CharField(max_length=255, serialize=False, primary_key=True)),
                ('departure_time', models.CharField(max_length=20)),
                ('days_of_week', models.CharField(null=True, max_length=100)),
                ('journey_pattern', models.ForeignKey(to='transport.JourneyPattern', related_name='journeys',
                                                      on_delete=django.db.models.deletion.CASCADE)),
            ],
        ),
        migrations.RenameModel(
            old_name='BusOperator',
            new_name='Operator',
        ),
        migrations.RemoveField(
            model_name='busjourney',
            name='line',
        ),
        migrations.RemoveField(
            model_name='busjourney',
            name='pattern',
        ),
        migrations.RemoveField(
            model_name='busjourneypattern',
            name='route',
        ),
        migrations.RemoveField(
            model_name='busjourneypattern',
            name='section',
        ),
        migrations.RemoveField(
            model_name='busjourneypatternsection',
            name='line',
        ),
        migrations.RemoveField(
            model_name='busline',
            name='operator',
        ),
        migrations.RemoveField(
            model_name='busroute',
            name='line',
        ),
        migrations.DeleteModel(
            name='BusStop',
        ),
        migrations.DeleteModel(
            name='BusJourney',
        ),
        migrations.DeleteModel(
            name='BusJourneyPattern',
        ),
        migrations.DeleteModel(
            name='BusJourneyPatternSection',
        ),
        migrations.DeleteModel(
            name='BusLine',
        ),
        migrations.DeleteModel(
            name='BusRoute',
        ),
        migrations.AddField(
            model_name='line',
            name='operator',
            field=models.ForeignKey(to='transport.Operator', related_name='lines',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
        migrations.AddField(
            model_name='journeypatterntiminglink',
            name='stop_from',
            field=models.ForeignKey(related_name='departure_journeys', to_field='atco_code', to='transport.Stop',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
        migrations.AddField(
            model_name='journeypatterntiminglink',
            name='stop_to',
            field=models.ForeignKey(related_name='arrival_journeys', to_field='atco_code', to='transport.Stop',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
        migrations.AddField(
            model_name='journeypattern',
            name='route',
            field=models.ForeignKey(to='transport.Route', related_name='journey_patterns',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
        migrations.AddField(
            model_name='journeypattern',
            name='section',
            field=models.ForeignKey(to='transport.JourneyPatternSection', related_name='journey_patterns',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
    ]
