# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0012_auto_20170304_1250'),
    ]

    operations = [
        migrations.AlterField(
            model_name='journeypattern',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='journeypatternsection',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='line',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='route',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='stop',
            name='atco_code',
            field=models.CharField(max_length=12, serialize=False, unique=True, db_index=True, primary_key=True),
        ),
        migrations.AlterField(
            model_name='vehiclejourney',
            name='id',
            field=models.CharField(max_length=255, serialize=False, db_index=True, primary_key=True),
        ),
    ]
