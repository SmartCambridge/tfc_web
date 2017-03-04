# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0010_auto_20170304_1206'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='stop',
            name='id',
        ),
        migrations.AlterField(
            model_name='stop',
            name='atco_code',
            field=models.CharField(primary_key=True, serialize=False, max_length=12, unique=True),
        ),
    ]
