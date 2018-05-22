from rest_framework import serializers


class AQHeaderSerializer(serializers.Serializer):
    BatteryVoltage = serializers.FloatField()
    COFinal = serializers.FloatField()
    COOffset = serializers.FloatField()
    COPrescaled = serializers.FloatField()
    COScaled = serializers.FloatField()
    COSerialNumber = serializers.IntegerField()
    COSlope = serializers.FloatField()
    COStatus = serializers.CharField()
    GasProtocol = serializers.IntegerField()
    GasStatus = serializers.CharField()
    Humidity = serializers.FloatField()
    Latitude = serializers.FloatField()
    Longitude = serializers.FloatField()
    Name = serializers.CharField()
    NO2Final = serializers.FloatField()
    NO2Offset = serializers.FloatField()
    NO2Prescaled = serializers.FloatField()
    NO2Scaled = serializers.FloatField()
    NO2SerialNumber = serializers.IntegerField()
    NO2Slope = serializers.FloatField()
    NO2Status = serializers.CharField()
    NOFinal = serializers.FloatField()
    NOOffset = serializers.FloatField()
    NOPrescaled = serializers.FloatField()
    NOScaled = serializers.FloatField()
    NOSerialNumber = serializers.IntegerField()
    NOSlope = serializers.FloatField()
    NOStatus = serializers.CharField()
    O3Final = serializers.FloatField()
    O3Offset = serializers.FloatField()
    O3Prescaled = serializers.FloatField()
    O3Scaled = serializers.FloatField()
    O3SerialNumber = serializers.IntegerField()
    O3Slope = serializers.FloatField()
    O3Status = serializers.CharField()
    OtherInfo = serializers.CharField()
    P1 = serializers.IntegerField()
    P2 = serializers.IntegerField()
    P3 = serializers.IntegerField()
    PodFeaturetype = serializers.IntegerField()
    Pressure = serializers.FloatField()
    SO2Final = serializers.FloatField()
    SO2Offset = serializers.FloatField()
    SO2Prescaled = serializers.FloatField()
    SO2Scaled = serializers.FloatField()
    SO2SerialNumber = serializers.IntegerField()
    SO2Slope = serializers.FloatField()
    SO2Status = serializers.CharField()
    StationID = serializers.IntegerField()
    Temperature = serializers.FloatField()
    Timestamp = serializers.CharField()


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
