class CSNRouter(object):
    """
    A router to control all database operations on models in the
    csn application.
    """
    def db_for_read(self, model, **hints):
        """
        Attempts to read csn models go to csn database.
        """
        if model._meta.app_label == 'csn':
            return 'csn'
        return 'default'

    def db_for_write(self, model, **hints):
        """
        Attempts to write csn models go to csn database.
        """
        if model._meta.app_label == 'csn':
            return 'csn'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """
        Always allow relations
        """
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Make sure the csn app only appears in the csn database.
        """
        if app_label == 'csn':
            return db == 'csn'
        else:
            return db == 'default'
