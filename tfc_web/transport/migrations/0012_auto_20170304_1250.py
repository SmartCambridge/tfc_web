# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import django
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0011_auto_20170304_1249'),
    ]

    operations = [
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='stop_from',
            field=models.ForeignKey(related_name='departure_journeys', to='transport.Stop',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='stop_to',
            field=models.ForeignKey(related_name='arrival_journeys', to='transport.Stop',
                                    on_delete=django.db.models.deletion.CASCADE),
        ),
    ]
