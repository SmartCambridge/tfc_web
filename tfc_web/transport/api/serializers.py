from rest_framework import serializers
from transport.models import VehicleJourney, Line, Stop


class VehicleJourneySerializer(serializers.ModelSerializer):
    timetable = serializers.SerializerMethodField()

    def get_timetable(self, obj):
        return obj.get_timetable().values('order', 'stop_id', 'time')

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
        fields = '__all__'
