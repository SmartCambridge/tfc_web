# Generated by Django 3.2.16 on 2022-11-28 21:31

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0037_auto_20201024_1419'),
    ]

    operations = [
        migrations.AlterField(
            model_name='line',
            name='stop_list',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='line',
            name='timetable',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='stop',
            name='data',
            field=models.JSONField(blank=True, null=True),
        ),
    ]