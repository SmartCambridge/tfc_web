from rest_framework import serializers


class AQHeaderSerializer(serializers.Serializer):
    BatteryVoltage = serializers.FloatField(required=False)
    COFinal = serializers.FloatField(required=False)
    COOffset = serializers.FloatField(required=False)
    COPrescaled = serializers.FloatField(required=False)
    COScaled = serializers.FloatField(required=False)
    COSerialNumber = serializers.IntegerField(required=False)
    COSlope = serializers.FloatField(required=False)
    COStatus = serializers.CharField(required=False)
    GasProtocol = serializers.IntegerField(required=False)
    GasStatus = serializers.CharField(required=False)
    Humidity = serializers.FloatField(required=False)
    Latitude = serializers.FloatField(required=False)
    Longitude = serializers.FloatField(required=False)
    Name = serializers.CharField(required=False)
    NO2Final = serializers.FloatField(required=False)
    NO2Offset = serializers.FloatField(required=False)
    NO2Prescaled = serializers.FloatField(required=False)
    NO2Scaled = serializers.FloatField(required=False)
    NO2SerialNumber = serializers.IntegerField(required=False)
    NO2Slope = serializers.FloatField(required=False)
    NO2Status = serializers.CharField(required=False)
    NOFinal = serializers.FloatField(required=False)
    NOOffset = serializers.FloatField(required=False)
    NOPrescaled = serializers.FloatField(required=False)
    NOScaled = serializers.FloatField(required=False)
    NOSerialNumber = serializers.IntegerField(required=False)
    NOSlope = serializers.FloatField(required=False)
    NOStatus = serializers.CharField(required=False)
    O3Final = serializers.FloatField(required=False)
    O3Offset = serializers.FloatField(required=False)
    O3Prescaled = serializers.FloatField(required=False)
    O3Scaled = serializers.FloatField(required=False)
    O3SerialNumber = serializers.IntegerField(required=False)
    O3Slope = serializers.FloatField(required=False)
    O3Status = serializers.CharField(required=False)
    OtherInfo = serializers.CharField(required=False)
    P1 = serializers.IntegerField(required=False)
    P2 = serializers.IntegerField(required=False)
    P3 = serializers.IntegerField(required=False)
    PodFeaturetype = serializers.IntegerField(required=False)
    Pressure = serializers.FloatField(required=False)
    SO2Final = serializers.FloatField(required=False)
    SO2Offset = serializers.FloatField(required=False)
    SO2Prescaled = serializers.FloatField(required=False)
    SO2Scaled = serializers.FloatField(required=False)
    SO2SerialNumber = serializers.IntegerField(required=False)
    SO2Slope = serializers.FloatField(required=False)
    SO2Status = serializers.CharField(required=False)
    StationID = serializers.IntegerField(required=False)
    Temperature = serializers.FloatField(required=False)
    Timestamp = serializers.CharField(required=False)


class AQDataSerializer(serializers.Serializer):
    Header = AQHeaderSerializer()
    Readings = serializers.ListField(
        child=serializers.ListField(
            child=serializers.FloatField(), min_length=2, max_length=2
        )
    )
    SensorType = serializers.CharField()


# date_from, date_to, Description are not necessarily populated
# in all entries, hence required=False


class AQConfigSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='StationID')
    acp_lat = serializers.FloatField(source='Latitude')
    acp_lng = serializers.FloatField(source='Longitude')
    date_from = serializers.CharField(required=False)
    date_to = serializers.CharField(required=False)
    Description = serializers.CharField(required=False)
    FeedID = serializers.CharField()
    Latitude = serializers.FloatField()
    Longitude = serializers.FloatField()
    Name = serializers.CharField()
    SensorTypes = serializers.ListField(child=serializers.CharField())
    StationID = serializers.CharField()


class AQListSerializer(serializers.Serializer):
    aq_list = AQConfigSerializer(many=True)
