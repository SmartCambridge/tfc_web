from rest_framework import serializers
from api import util

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
    date = util.EpochField(source='ts')


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
