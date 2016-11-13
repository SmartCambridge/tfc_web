# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('realtime', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='busstop',
            name='default_wait_time',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
