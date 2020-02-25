
import logging
import json
import re
import os

from django.http import HttpResponse, Http404
from django.shortcuts import redirect, render
from django.conf import settings
from django.urls import reverse
from django.utils.http import is_safe_url
from django.template.exceptions import TemplateDoesNotExist
from django.template.loader import get_template

from smartcambridge.decorator import smartcambridge_valid_user

logger = logging.getLogger(__name__)


@smartcambridge_valid_user
def login_and_agree(request):
    '''
    Trivial view to redirect to 'next' after confirming
    that the user is authenticated and has agreed to the SmartCambridge
    TCs
    '''
    redirect_to = request.GET.get('next')
    url_is_safe = is_safe_url(
        url=redirect_to,
        allowed_hosts=request.get_host(),
        require_https=request.is_secure(),
    )
    if url_is_safe and redirect_to:
        return redirect(redirect_to)
    return redirect(reverse('api_home'))


def nginx_auth_probe(request):
    '''
    An endpoint intended to be called by Nginx's Auth Request module
    to find out if the current user is authenticated and a smartcambridge
    user
    '''

    u = request.user
    if (u.is_authenticated and
       hasattr(u, 'smartcambridge_user') and
       u.smartcambridge_user.accepted_tcs):
        return HttpResponse(status=200)
    return HttpResponse(status=403)


def download(request):
    '''
    Generate an index of the files available through the download API
    '''
    # Where the downloadable archives are accumulated
    source_dir = os.path.join(settings.DATA_PATH, 'download_api')

    # Build a list of the available files for each feed
    template_data = []

    for feed in settings.DOWNLOAD_FEEDS:

        # Skip feeds without 'display': True
        if not feed.get('display'):
            continue

        # Skip feeds with no archive data directory
        feed_source = os.path.join(source_dir, feed['name'])
        if not os.path.isdir(feed_source):
            continue

        # Build a list of titles and filenames of metadata files available
        # for download, from the 'title' and 'destination_filename' values
        # in each 'metadata' item for this feed from settings.DOWNLOAD_FEEDS
        metadata = []
        if 'metadata' in feed:
            for metadata_item in feed['metadata']:
                filename = metadata_item['destination_filename'] + '.zip'
                # Only include files that actually exist...
                if os.path.exists(os.path.join(source_dir, feed['name'], filename)):
                    metadata.append({
                        'title': metadata_item['title'],
                        'filename': filename,
                    })

        # Build a list of titles and filename lists of data files available
        # for download, from the 'title' and 'destination_filename' values
        # in each 'archives' item for this feed from settings.DOWNLOAD_FEEDS
        data = []
        if 'archives' in feed:
            for archive_item in feed['archives']:
                archive_pattern = archive_item['destination_filename']
                # Convert '{...}' format() patterns into '\d+' regexp patterns
                # This does rather assume that all format substitutions are numeric...
                archive_pattern = re.sub(r'\{date:.*?\}', r'\d+', archive_pattern)
                archive_pattern += '.zip'
                # Include all the filenames in archive directory that match the pattern
                # and which don't accidentally include the string 'metadata'
                filenames = [
                    f for f in sorted(os.listdir(os.path.join(source_dir, feed['name'])))
                    if re.fullmatch(archive_pattern, f) and 'metadata' not in f
                ]
                data.append({
                    'title': archive_item['title'],
                    'filenames': filenames
                })

        # See if there's a template containing documentation
        try:
            get_template('api/' + feed['name'] + '-schema.html')
            info_template = True
        except TemplateDoesNotExist:
            info_template = False

        template_data.append({
            'name': feed['name'],
            'title': feed['title'],
            'desc': feed['desc'],
            'metadata': metadata,
            'data': data,
            'info_template': info_template
        })

    return render(request, 'api/download.html', {
        'feeds':  template_data,
    })


def download_schema(request, feed):
    try:
        return render(request, 'api/' + feed + '-schema.html')
    except TemplateDoesNotExist:
        raise Http404("Document not found")
