# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0007_auto_20170220_0005'),
    ]

    operations = [
        migrations.AddField(
            model_name='line',
            name='end_date',
            field=models.DateField(null=True),
        ),
        migrations.AddField(
            model_name='line',
            name='start_date',
            field=models.DateField(null=True),
        ),
    ]
