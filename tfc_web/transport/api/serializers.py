from rest_framework import serializers
from transport.models import VehicleJourney


class VehicleJourneySerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleJourney
        fields = '__all__'
