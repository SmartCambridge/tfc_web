# -*- coding: utf-8 -*-
# Generated by Django 1.11.4 on 2017-08-06 15:47
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('csn', '0004_auto_20170806_1435'),
    ]

    operations = [
        migrations.AddField(
            model_name='lwdevice',
            name='activation_type',
            field=models.CharField(choices=[('otaa', 'Over the Air Activation'), ('abp', 'Activation by personalisation')], default='abp', max_length=5),
            preserve_default=False,
        ),
    ]