# Utility functions for extractors

from datetime import datetime

from pytz import timezone


def epoch_to_text(ts):
    '''
    Convert an epoch timestamp to UK local time as text
    '''
    return datetime.fromtimestamp(ts, tz=timezone('Europe/London')).isoformat()
