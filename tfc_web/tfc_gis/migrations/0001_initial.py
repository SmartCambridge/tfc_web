# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django.db import migrations, models
import django.contrib.gis.db.models.fields


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Area',
            fields=[
                ('id', models.AutoField(primary_key=True, verbose_name='ID', serialize=False, auto_created=True)),
                ('name', models.CharField(max_length=100)),
                ('poly', django.contrib.gis.db.models.fields.PolygonField(srid=4326)),
            ],
        ),
    ]
