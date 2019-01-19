FROM python:3.6-slim-stretch

# Do everything relative to /usr/src/app which is where we install our
# application.
WORKDIR /usr/src/app

RUN apt-get -y update && apt-get install -y binutils libproj-dev gdal-bin git gcc

# Install any explicit requirements
ADD requirements.txt ./
RUN pip install --upgrade -r ./requirements.txt

# The webapp source will be mounted here as a volume
VOLUME /usr/src/app

COPY docker/wait-for-it.sh ./
RUN install wait-for-it.sh /usr/local/bin/wait-for-it

# By default, use the Django development server to serve the application and use
# developer-specific settings.
#
# *DO NOT DEPLOY THIS TO PRODUCTION*
ENV DJANGO_SETTINGS_MODULE tfc_web.settings
ENTRYPOINT ["./manage.py"]
CMD ["runserver", "0.0.0.0:8000"]
