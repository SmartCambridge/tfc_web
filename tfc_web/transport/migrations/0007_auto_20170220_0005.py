# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import django
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0006_auto_20170207_2229'),
    ]

    operations = [
        migrations.AddField(
            model_name='line',
            name='bank_holiday_operation',
            field=models.CharField(max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='line',
            name='regular_days_of_week',
            field=models.CharField(max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='journey_pattern_section',
            field=models.ForeignKey(related_name='timing_links', to='transport.JourneyPatternSection',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
    ]
