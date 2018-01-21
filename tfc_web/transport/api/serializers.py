from rest_framework import serializers
from transport.models import VehicleJourney


class VehicleJourneySerializer(serializers.ModelSerializer):
    timetable = serializers.SerializerMethodField()

    def get_timetable(self, obj):
        return obj.get_timetable().values('order', 'stop_id', 'time')

    class Meta:
        model = VehicleJourney
        fields = '__all__'
        depth = 4
