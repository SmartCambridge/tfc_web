from rest_framework import serializers
from api import util
from traffic.models import ANPRCamera


class ZoneJourneySerializer(serializers.Serializer):
    line = serializers.CharField(source='LineRef')
    direction = serializers.CharField(source='DirectionRef')
    operator = serializers.CharField(source='OperatorRef')
    origin = serializers.CharField(source='OriginRef')
    origin_name = serializers.CharField(source='OriginName')
    destination = serializers.CharField(source='DestinationRef')
    destination_name = serializers.CharField(source='DestinationName')
    departure_time = serializers.CharField(source='OriginAimedDepartureTime')


class ZoneRecordSerializer(serializers.Serializer):
    acp_ts = serializers.IntegerField(source='ts')
    date = util.EpochField(source='ts')
    duration = serializers.IntegerField()
    ts = serializers.IntegerField()
    ts_delta = serializers.IntegerField()
    vehicle_id = serializers.CharField()
    distance = serializers.FloatField(required=False)
    avg_speed = serializers.FloatField(required=False)
    journey = ZoneJourneySerializer(source='position_record')


class ZoneHistorySerializer(serializers.Serializer):
    request_data = ZoneRecordSerializer(many=True)


class ZonePointSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    acp_lat = serializers.FloatField(source='lat')
    lng = serializers.FloatField()
    acp_lng = serializers.FloatField(source='lng')

# Serializer can't cope with keys containing '.', so this model
# is written with keys containing '_' and the retrieved data is
# rewritten to contain such keys before marshalling


class ZoneConfigSerializer(serializers.Serializer):
    zone_id = serializers.CharField()
    acp_id = serializers.CharField(source='zone_id')
    zone_reverse_id = serializers.CharField(required=False)
    zone_center = ZonePointSerializer()
    zone_zoom = serializers.IntegerField()
    zone_path = ZonePointSerializer(many=True)
    zone_finish_index = serializers.IntegerField()
    zone_name = serializers.CharField()
    zone_map = serializers.BooleanField(required=False)


class ZoneListSerializer(serializers.Serializer):
    zone_list = ZoneConfigSerializer(many=True)


class ANPRCameraSerializer(serializers.ModelSerializer):

    class Meta:
        model = ANPRCamera
        fields = ['id', 'description', 'lat', 'lng']
