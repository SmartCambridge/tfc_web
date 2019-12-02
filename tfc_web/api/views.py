
import logging
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
    files = []
    for feed in sorted(settings.DOWNLOAD_FEEDS, key=lambda v: v['title']):

        # Skip feeds without 'display': True
        if not feed.get('display'):
            continue

        # Skip feeds with no archive data directory
        feed_source = os.path.join(source_dir, feed['name'])
        if not os.path.isdir(feed_source):
            continue

        # Collect al lthe files
        feed_files = {'day': [], 'month': [], 'year': []}
        for file in sorted(os.listdir(feed_source)):
            # <feed>/<section>-yyyy.zip
            # <feed>/<section>-yyyy-mm.zip
            # <feed>/<section>-yyyy-mm-dd.zip
            # <feed>/<section>-metadata.zip
            match = re.search(r'(.*?)-(\d\d\d\d)(?:-(\d\d))?(?:-(\d\d))?.zip$', file)
            if match:
                section, year, month, day = match.group(1, 2, 3, 4)
                if day:
                    feed_files['day'].append({'s': section, 'y': year, 'm': month, 'd': day})
                elif month:
                    feed_files['month'].append({'s': section, 'y': year, 'm': month})
                else:
                    feed_files['year'].append({'s': section, 'y': year})
            match = re.search(r'(.*?)-metadata.zip', file)
            if match:
                section = match.group(1)
                feed_files['metadata'] = (section)

        # See if there's a template containing documentation
        try:
            get_template('api/' + feed['name'] + '-schema.html')
            info_template = True
        except TemplateDoesNotExist:
            info_template = False

        files.append({
            'name': feed['name'],
            'title': feed['title'],
            'desc': feed['desc'],
            'feed_files': feed_files,
            'info_template': info_template
        })

    return render(request, 'api/download.html', {
        'files':  files,
    })


def download_schema(request, feed):
    try:
        return render(request, 'api/' + feed + '-schema.html')
    except TemplateDoesNotExist:
        raise Http404("Document not found")
