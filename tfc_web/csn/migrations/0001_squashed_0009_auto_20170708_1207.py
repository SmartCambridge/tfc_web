# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    replaces = [('csn', '0001_initial'), ('csn', '0002_auto_20170509_2118'), ('csn', '0003_lwapplication_lwcallbackurl'), ('csn', '0004_auto_20170516_2125'), ('csn', '0005_lwdevice_lw_application'), ('csn', '0006_remove_lwapplication_app_eui'), ('csn', '0007_auto_20170706_2148'), ('csn', '0008_auto_20170708_1203'), ('csn', '0009_auto_20170708_1207')]

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='LWDevice',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dev_class', models.CharField(choices=[('A', 'A'), ('C', 'C')], max_length=1)),
                ('counters_size', models.IntegerField(choices=[(2, 2), (4, 4)])),
                ('dev_addr', models.CharField(max_length=8, validators=[django.core.validators.RegexValidator('^[0-9a-fA-F]+$', 'Should match the ^[0-9a-fA-F]+$ pattern'), django.core.validators.MinLengthValidator(8)])),
                ('nwkskey', models.CharField(max_length=32, validators=[django.core.validators.RegexValidator('^[0-9a-fA-F]+$', 'Should match the ^[0-9a-fA-F]+$ pattern'), django.core.validators.MinLengthValidator(32)])),
                ('user_id', models.IntegerField()),
                ('dev_eui', models.CharField(max_length=16, unique=True, validators=[django.core.validators.RegexValidator('^[0-9a-fA-F]+$', 'Should match the ^[0-9a-fA-F]+$ pattern'), django.core.validators.MinLengthValidator(16)])),
                ('description', models.CharField(max_length=255)),
                ('name', models.CharField(max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='LWApplication',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('description', models.CharField(max_length=255)),
                ('url', models.URLField()),
                ('user_id', models.IntegerField()),
            ],
        ),
        migrations.AddField(
            model_name='lwdevice',
            name='lw_application',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lw_devices', to='csn.LWApplication'),
            preserve_default=False,
        ),
    ]
