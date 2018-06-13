# -*- coding: utf-8 -*-
# Generated by Django 1.11.13 on 2018-06-10 18:35
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0031_auto_20180609_1655'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='line',
            name='rendered_timetable',
        ),
        migrations.AddField(
            model_name='line',
            name='filename',
            field=models.CharField(default='', max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='line',
            name='line_id',
            field=models.CharField(db_index=True, default='', max_length=255),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='line',
            name='slug',
            field=models.SlugField(default=''),
            preserve_default=False,
        ),
        migrations.RemoveField(
            model_name='line',
            name='id'
        ),
        migrations.AddField(
            model_name='line',
            name='id',
            field=models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
    ]