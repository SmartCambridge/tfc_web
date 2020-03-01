from rest_framework import serializers
from api import util
from traffic.models import ANPRCamera, Trip


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


class BTJourneyLatLngSearializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class BTJourneySiteSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='id')
    acp_ts = serializers.IntegerField(source='ts')
    acp_lat = serializers.FloatField(source='location.lat')
    acp_lng = serializers.FloatField(source='location.lng')
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    location = BTJourneyLatLngSearializer()
    ts = serializers.IntegerField()
    ts_text = util.EpochField(source='ts')


class BTJourneySiteListSerializer(serializers.Serializer):
    site_list = BTJourneySiteSerializer(many=True)


class BTJourneyLinkOrRouteSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='id')
    acp_ts = serializers.IntegerField(source='ts')
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    sites = serializers.ListField(
        child=serializers.CharField()
    )
    links = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    length = serializers.IntegerField()
    ts = serializers.IntegerField()
    ts_text = util.EpochField(source='ts')


class BTJourneyLinkListSerializer(serializers.Serializer):
    link_list = BTJourneyLinkOrRouteSerializer(many=True)


class BTJourneyRouteListSerializer(serializers.Serializer):
    route_list = BTJourneyLinkOrRouteSerializer(many=True)


class BTJourneyLinkRecordSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='id')
    acp_ts = serializers.IntegerField(source='ts', required=False)
    id = serializers.CharField()
    time = serializers.CharField()
    period = serializers.IntegerField()
    travelTime = serializers.IntegerField()
    normalTravelTime = serializers.IntegerField()
    ts = serializers.IntegerField(required=False)
    ts_text = util.EpochField(source='ts', required=False)


class BTJourneyLinkRecordListSerializer(serializers.Serializer):
    request_data = BTJourneyLinkRecordSerializer(many=True)
    ts = serializers.IntegerField(required=False)
    ts_text = util.EpochField(source='ts', required=False)


class ANPRCameraSerializer(serializers.ModelSerializer):

    class Meta:
        model = ANPRCamera
        fields = ['id', 'description', 'lat', 'lng']


class ANPRTripSerializer(serializers.ModelSerializer):

    class Meta:
        model = Trip
        fields = ['entry_time', 'entry_lane', 'entry_direction', 'entry_camera_id', 'entry_absolute_direction',
                  'confidence', 'exit_time', 'exit_lane', 'exit_direction', 'exit_camera_id', 'exit_absolute_direction',
                  'journey_time']
