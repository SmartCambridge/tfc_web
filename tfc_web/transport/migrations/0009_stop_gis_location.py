# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.db import migrations, models
import django.contrib.gis.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0008_auto_20170220_0013'),
    ]

    operations = [
        migrations.AddField(
            model_name='stop',
            name='gis_location',
            field=django.contrib.gis.db.models.fields.PointField(srid=4326, null=True),
        ),
    ]
