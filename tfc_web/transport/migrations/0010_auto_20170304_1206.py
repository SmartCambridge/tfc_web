# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0009_stop_gis_location'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stop',
            name='naptan_code',
            field=models.CharField(max_length=12),
        ),
        migrations.AlterField(
            model_name='stop',
            name='nptg_locality_code',
            field=models.CharField(max_length=12),
        ),
    ]
