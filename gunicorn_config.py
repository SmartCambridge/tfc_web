# Gunicorn config

worker_class = "gthread"
workers = 10
threads = 15
max_requests = 1000
max_requests_jitter = 100

reload = True

capture_output = "True"
errorlog = "/var/log/tfc_prod/gunicorn.err"
accesslog = "/var/log/tfc_prod/gunicorn.log"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

statsd_host = "localhost:9125"
statsd_prefix = "tfc_web"
