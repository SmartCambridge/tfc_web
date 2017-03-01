# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tfc_gis', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='area',
            name='image',
            field=models.ImageField(upload_to='', blank=True, null=True),
        ),
    ]
