from copy import copy

from django.utils import log
from django.conf import settings
from django.views.debug import ExceptionReporter

class AdminEmailHandler(log.AdminEmailHandler):
    """
    tfc_web custom debug email handler.
    This sub-classes the standard django.utils.log.AdminEmailHandler
    so we have control of the subject line.
    This class can be extended with a sub-class of debug.ExceptionReporter to customise the
    actual content.
    Technique from:
    https://stackoverflow.com/questions/36165790/django-error-email-is-too-long-how-do-i-truncate-it
    """

    def emit(self, record):
        try:
            request = record.request
            hostname = request.get_host()
            subject = '%s %s' % (
                hostname.split('.')[0], # e.g. tfc-app2
                record.getMessage()
            )
        except Exception:
            subject = '%s: %s' % (
                record.levelname,
                record.getMessage()
            )
            request = None
            hostname = None

        subject = self.format_subject(subject)

        # Since we add a nicely formatted traceback on our own, create a copy
        # of the log record without the exception data.
        no_exc_record = copy(record)
        no_exc_record.exc_info = None
        no_exc_record.exc_text = None

        if record.exc_info:
            exc_info = record.exc_info
        else:
            exc_info = (None, record.getMessage(), None)

        reporter = ExceptionReporter(request, is_email=True, *exc_info)
        message = "%s\n\n%s" % (self.format(no_exc_record), reporter.get_traceback_text())
        html_message = reporter.get_traceback_html() if self.include_html else None
        self.send_mail(subject, message, fail_silently=True, html_message=html_message)

