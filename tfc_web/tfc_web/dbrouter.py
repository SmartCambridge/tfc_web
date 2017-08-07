class CSNRouter(object):
    """
    A router to control all database operations on models Sensor, Destination, and SensorData in the csn application.
    """
    def db_for_read(self, model, **hints):
        """
        Attempts to read Sensor, Destination, and SensorData models go to tfcserver database.
        """
        if model._meta.app_label == 'csn' and model._meta.object_name in ['Sensor', 'Destination', 'SensorData']:
            return 'tfcserver'
        return 'default'

    def db_for_write(self, model, **hints):
        """
        Attempts to write Sensor, Destination, and SensorData models go to tfcserver database.
        """
        if model._meta.app_label == 'csn' and model._meta.object_name in ['Sensor', 'Destination', 'SensorData']:
            return 'tfcserver'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """
        Always allow relations
        """
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure that migrations are only applied to the default database
        """
        return db == 'default'
