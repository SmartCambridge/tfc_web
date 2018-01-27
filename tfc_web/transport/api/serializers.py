from rest_framework import serializers
from transport.models import VehicleJourney, Line, Stop, Timetable


class VehicleJourneySerializer(serializers.ModelSerializer):
    timetable = serializers.SerializerMethodField()

    def get_timetable(self, obj):
        return TimetableSerializerForJourney(obj.get_timetable(), many=True).data

    class Meta:
        model = VehicleJourney
        fields = '__all__'
        depth = 4


class LineSerializer(serializers.ModelSerializer):

    class Meta:
        model = Line
        fields = '__all__'


class StopSerializer(serializers.ModelSerializer):

    class Meta:
        model = Stop
        fields = ['atco_code', 'naptan_code', 'common_name', 'indicator', 'locality_name', 'longitude', 'latitude']


class TimetableSerializerForJourney(serializers.ModelSerializer):
    stop = serializers.SerializerMethodField()

    def get_stop(self, obj):
        return StopSerializer(obj.stop).data

    class Meta:
        model = Timetable
        fields = ['order', 'stop', 'time']
        depth = 2
