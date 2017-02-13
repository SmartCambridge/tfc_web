# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0004_auto_20170123_1958'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stop',
            name='short_common_name',
            field=models.CharField(max_length=64),
        ),
    ]
