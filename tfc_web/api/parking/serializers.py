from rest_framework import serializers
from datetime import datetime, timezone
import re

# maximum days allowed in one hit
MAX_DAYS = 31


class EpochField(serializers.Field):
    ''' Serialize a Unix timestamp as an ISO data-time representation '''
    def to_representation(self, obj):
        return datetime.fromtimestamp(
          int(obj), tz=timezone.utc).isoformat()


class ListArgsSerializer(serializers.Serializer):
    ''' Common query string parameters '''
    start_date = serializers.DateField(input_formats=['%Y-%m-%d'])
    end_date = serializers.DateField(input_formats=['%Y-%m-%d'], required=False)
    feed_id = serializers.CharField(required=False)

    def validate_feed_id(self, id):
        if not re.match(r'^[a-z0-9_-]+$', id):
            raise serializers.ValidationError("Incorrect feed_id format")
        return id

    def validate(self, data):
        ''' Check that end date isn't more than MAX_DAYS days from start_date '''
        if 'end_date' in data:
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError(
                    'end_date \'{0}\' is before start_date \'{1}\''
                    .format(data['end_date'], data['start_date']))
            day_count = (data['end_date'] - data['start_date']).days + 1
            if day_count > MAX_DAYS:
                raise serializers.ValidationError(
                    '{0} days data requested, maximum of {1} allowed'
                    .format(day_count, MAX_DAYS))
        return data


# In some error conditions,  spaces_occupied, spaces_capacity, and spaces_free
# are missing from the stored data. hence their being marked required=False
# below.
class ParkingRecordSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='parking_id')
    acp_ts = serializers.IntegerField(source='ts')
    feed_id = serializers.CharField()
    parking_id = serializers.CharField()
    spaces_capacity = serializers.IntegerField(required=False)
    spaces_free = serializers.IntegerField(required=False)
    spaces_occupied = serializers.IntegerField(required=False)
    ts = serializers.IntegerField()
    date = EpochField(source='ts')


class ParkingHistorySerializer(serializers.Serializer):
    request_data = ParkingRecordSerializer(many=True)


class ParkingConfigSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='parking_id')
    acp_lat = serializers.FloatField(source='latitude')
    acp_lng = serializers.FloatField(source='longitude')
    feed_id = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    parking_id = serializers.CharField()
    parking_name = serializers.CharField()
    parking_type = serializers.CharField()
    spaces_capacity = serializers.IntegerField(source='capacity')


class ParkingListSerializer(serializers.Serializer):
    parking_list = ParkingConfigSerializer(many=True)
