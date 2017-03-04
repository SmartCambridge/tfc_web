# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0013_auto_20170304_1557'),
    ]

    operations = [
        migrations.AddField(
            model_name='line',
            name='rendered_timetable',
            field=models.TextField(blank=True, null=True),
        ),
    ]
