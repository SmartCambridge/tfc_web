from rest_framework import serializers
from transport.models import Stop, VehicleJourney, Line, Operator, Service, JourneyPattern, JourneyPatternTimingLink


class VehicleJourneySerializer(serializers.ModelSerializer):

    class Meta:
        model = VehicleJourney
        fields = '__all__'
        depth = 4


class VehicleJourneySummarisedSerializer(serializers.ModelSerializer):
    #direction = serializers.CharField(source='journey_pattern.direction')
    direction = serializers.CharField()
    #route_description = serializers.CharField(source='journey_pattern.route.description')

    class Meta:
        model = VehicleJourney
        fields = ['id', 'departure_time', 'direction'] #, 'timetable', 'days_of_week', 'route_description']
        depth = 3


class OperatorSerializer(serializers.ModelSerializer):

    class Meta:
        model = Operator
        fields = ['operator_id', 'operator_code', 'operator_short_name', 'operator_name', 'trading_name']


class JourneyPatternSerializer(serializers.ModelSerializer):
    service = serializers.SerializerMethodField()
    # timetable = serializers.SerializerMethodField()

    def get_service(self, obj):
        return ServiceSerializer(obj.service).data

    def get_timetable(self, obj):
        return JourneyPatternTimingLinkSerializer(obj.journeypatterntiminglink_set.all(), many=True).data
    
    class Meta:
        model = JourneyPattern
        fields = ['direction', 'destination_display', 'service']#, 'timetable']


class JourneyPatternTimingLinkSerializer(serializers.ModelSerializer):    
    class Meta:
        model = JourneyPatternTimingLink
        fields = ['from_display', 'from_stop_id', 'from_timing_status', 'from_sequence_number', 'to_display', 'to_stop_id', 'to_timing_status', 'to_sequence_number', 'run_time', 'direction']


class LineSerializer(serializers.ModelSerializer):
    # operator = serializers.SerializerMethodField()

    # def get_operator(self, obj):
    #     return OperatorSerializer(obj.operator).data

    class Meta:
        model = Line
        fields = ['line_id', 'line_name', 'description'] #['id', 'line_name', 'description', 'standard_origin', 'standard_destination', 'operator']
        depth = 2


class StopSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='atco_code')
    stop_id = serializers.CharField(source='atco_code')
    lat = serializers.FloatField(source='latitude')
    lng = serializers.FloatField(source='longitude')

    class Meta:
        model = Stop
        fields = ['id', 'stop_id', 'atco_code', 'naptan_code', 'common_name', 'indicator',
                  'locality_name', 'latitude', 'longitude', 'lat', 'lng']


class ServiceSerializer(serializers.ModelSerializer):
    operator = serializers.SerializerMethodField()
    line = serializers.SerializerMethodField()

    def get_operator(self, obj):
        return OperatorSerializer(obj.operator).data

    def get_line(self, obj):
        return LineSerializer(obj.line).data

    class Meta:
        model = Service
        fields = ['service_code', 'standard_origin', 'standard_destination', 'description', 'line', 'operator']
        depth = 2
