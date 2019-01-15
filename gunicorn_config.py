# Gunicorn config

worker_class = "gthread"
workers = 10
threads = 15

reload = True

capture_output = "True"
errorlog = "/var/log/tfc_prod/gunicorn.err"
accesslog = "/var/log/tfc_prod/gunicorn.log"