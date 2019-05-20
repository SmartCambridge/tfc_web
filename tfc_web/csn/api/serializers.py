from rest_framework import serializers

# In some error conditions,  spaces_occupied, spaces_capacity, and spaces_free
# are missing from the stored data. hence their being marked required=False
# below.


class DevConfigSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='dev_eui')
    dev_eui = serializers.CharField()


class AppConfigSerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='app_id')
    app_id = serializers.CharField()
    dev_list = DevConfigSerializer(many=True)


class AppListEntrySerializer(serializers.Serializer):
    acp_id = serializers.CharField(source='app_id')
    app_id = serializers.CharField()


class AppListSerializer(serializers.Serializer):
    app_list = AppListEntrySerializer(many=True)
