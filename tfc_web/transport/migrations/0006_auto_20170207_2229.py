# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0005_auto_20170131_2134'),
    ]

    operations = [
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='stop_from',
            field=models.ForeignKey(related_name='departure_journeys', to_field='atco_code', to='transport.Stop', db_constraint=False),
        ),
        migrations.AlterField(
            model_name='journeypatterntiminglink',
            name='stop_to',
            field=models.ForeignKey(related_name='arrival_journeys', to_field='atco_code', to='transport.Stop', db_constraint=False),
        ),
    ]
