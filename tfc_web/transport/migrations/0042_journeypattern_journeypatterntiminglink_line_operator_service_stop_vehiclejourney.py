# Generated by Django 3.2.16 on 2023-03-25 16:58

import django.contrib.gis.db.models.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0041_auto_20230325_1647'),
    ]

    operations = [
        migrations.CreateModel(
            name='Line',
            fields=[
                ('line_id', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('line_name', models.CharField(blank=True, max_length=255, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('transport_mode', models.CharField(blank=True, max_length=64, null=True)),
                ('private_code', models.CharField(blank=True, max_length=64, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Operator',
            fields=[
                ('operator_id', models.CharField(db_index=True, max_length=20, primary_key=True, serialize=False)),
                ('operator_code', models.CharField(db_index=True, max_length=20)),
                ('national_operator_code', models.CharField(db_index=True, max_length=20)),
                ('operator_short_name', models.CharField(blank=True, max_length=100, null=True)),
                ('operator_name', models.CharField(blank=True, max_length=200, null=True)),
                ('trading_name', models.CharField(blank=True, max_length=200, null=True)),
                ('contact_phone', models.CharField(blank=True, max_length=20, null=True)),
                ('contact_email', models.CharField(blank=True, max_length=200, null=True)),
                ('contact_url', models.CharField(blank=True, max_length=200, null=True)),
                ('license_number', models.CharField(blank=True, max_length=100, null=True)),
                ('license_expiry_date', models.DateField(blank=True, null=True)),
                ('street', models.CharField(blank=True, max_length=200, null=True)),
                ('locality', models.CharField(blank=True, max_length=200, null=True)),
                ('town', models.CharField(blank=True, max_length=200, null=True)),
                ('postcode', models.CharField(blank=True, max_length=10, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Service',
            fields=[
                ('service_code', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('operating_period_start', models.DateField()),
                ('operating_period_end', models.DateField(blank=True, null=True)),
                ('registered_travel_mode', models.CharField(blank=True, max_length=64, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('standard_origin', models.CharField(blank=True, max_length=255, null=True)),
                ('standard_destination', models.CharField(blank=True, max_length=255, null=True)),
                ('line', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.line')),
                ('operator', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.operator')),
                ('tx', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.transxchange')),
            ],
            options={
                'unique_together': {('service_code', 'tx')},
            },
        ),
        migrations.CreateModel(
            name='Stop',
            fields=[
                ('atco_code', models.CharField(max_length=16, primary_key=True, serialize=False)),
                ('naptan_code', models.CharField(blank=True, max_length=16, null=True)),
                ('short_common_name', models.CharField(blank=True, max_length=64, null=True)),
                ('common_name', models.CharField(blank=True, max_length=128, null=True)),
                ('landmark', models.CharField(blank=True, max_length=128, null=True)),
                ('street', models.CharField(blank=True, max_length=128, null=True)),
                ('crossing', models.CharField(blank=True, max_length=128, null=True)),
                ('indicator', models.CharField(blank=True, max_length=64, null=True)),
                ('bearing', models.CharField(blank=True, max_length=16, null=True)),
                ('nptg_locality_code', models.CharField(blank=True, max_length=16, null=True)),
                ('locality_name', models.CharField(blank=True, max_length=128, null=True)),
                ('parent_locality_name', models.CharField(blank=True, max_length=128, null=True)),
                ('grand_parent_locality_name', models.CharField(blank=True, max_length=128, null=True)),
                ('town', models.CharField(blank=True, max_length=128, null=True)),
                ('suburb', models.CharField(blank=True, max_length=128, null=True)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('stop_type', models.CharField(blank=True, max_length=16, null=True)),
                ('bus_stop_type', models.CharField(blank=True, max_length=16, null=True)),
                ('timing_status', models.CharField(blank=True, max_length=16, null=True)),
                ('accessibility', models.CharField(blank=True, max_length=16, null=True)),
                ('administrative_area_code', models.CharField(blank=True, max_length=16, null=True)),
                ('creation_date', models.DateField(blank=True, null=True)),
                ('modification_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(blank=True, max_length=16, null=True)),
                ('gis_location', django.contrib.gis.db.models.fields.PointField(null=True, srid=4326)),
                ('data', models.JSONField(blank=True, null=True)),
                ('last_modified', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['atco_code'],
            },
        ),
        migrations.CreateModel(
            name='JourneyPattern',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jp_id', models.CharField(max_length=50)),
                ('direction', models.CharField(blank=True, max_length=50, null=True)),
                ('destination_display', models.CharField(blank=True, max_length=500, null=True)),
                ('route_private_code', models.CharField(blank=True, max_length=255, null=True)),
                ('route_description', models.CharField(blank=True, max_length=500, null=True)),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.service')),
            ],
            options={
                'unique_together': {('jp_id', 'service')},
            },
        ),
        migrations.CreateModel(
            name='VehicleJourney',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vehicle_journey_code', models.CharField(blank=True, max_length=64, null=True)),
                ('vehicle_journey_id', models.CharField(blank=True, max_length=64, null=True)),
                ('departure_time', models.TimeField()),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('monday', models.BooleanField(default=False)),
                ('tuesday', models.BooleanField(default=False)),
                ('wednesday', models.BooleanField(default=False)),
                ('thursday', models.BooleanField(default=False)),
                ('friday', models.BooleanField(default=False)),
                ('saturday', models.BooleanField(default=False)),
                ('sunday', models.BooleanField(default=False)),
                ('bank_holiday_operation', models.TextField(blank=True, null=True)),
                ('direction', models.CharField(blank=True, max_length=50, null=True)),
                ('journey_pattern', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.journeypattern')),
                ('line', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='transport.line')),
                ('operator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='transport.operator')),
                ('service', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='transport.service')),
            ],
            options={
                'ordering': ['departure_time'],
                'unique_together': {('vehicle_journey_code', 'service')},
            },
        ),
        migrations.CreateModel(
            name='JourneyPatternTimingLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('jptl_id', models.CharField(max_length=50)),
                ('from_display', models.CharField(blank=True, max_length=255, null=True)),
                ('from_timing_status', models.CharField(blank=True, max_length=50, null=True)),
                ('from_sequence_number', models.IntegerField(blank=True, null=True)),
                ('to_display', models.CharField(blank=True, max_length=255, null=True)),
                ('to_timing_status', models.CharField(blank=True, max_length=50, null=True)),
                ('to_sequence_number', models.IntegerField(blank=True, null=True)),
                ('distance', models.IntegerField(blank=True, null=True)),
                ('direction', models.CharField(blank=True, max_length=50, null=True)),
                ('run_time', models.CharField(blank=True, max_length=50, null=True)),
                ('order', models.IntegerField()),
                ('from_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='journey_departures', to='transport.stop')),
                ('jp', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='transport.journeypattern')),
                ('to_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='journey_arrivals', to='transport.stop')),
            ],
            options={
                'ordering': ['order'],
                'unique_together': {('jptl_id', 'jp')},
            },
        ),
    ]