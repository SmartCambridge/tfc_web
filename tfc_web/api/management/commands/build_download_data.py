#!/usr/bin/env python3

'''
Create or update the archived data files served on request by the
download API. This command should be run periodically (ideally once a
day) as the tfc_prod user.
'''

import csv
import glob

import importlib
import logging
import os

from datetime import date
from tempfile import NamedTemporaryFile
from zipfile import ZipFile, ZIP_DEFLATED

from dateutil.relativedelta import relativedelta

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

SOURCE_DIR = settings.DATA_PATH
try:
    DEST_DIR = settings.DEST_DIR
except AttributeError:
    DEST_DIR = os.path.join(settings.DATA_PATH, 'download_api')
logger.debug('SOURCE_DIR: %s', SOURCE_DIR)
logger.debug('DEST_DIR: %s', DEST_DIR)

TODAY = date.today()

# Configuration of the archives to maintain. File patterns are processed
# by .format() with a single named parameter 'date' containing a
# datetime.date() object representing the start of the period to process


def get_function(name):
    '''
    Return the function identified by the Python path `name`
    '''

    path, function = name.rsplit('.', 1)

    module = importlib.import_module(path)
    return getattr(module, function)


def get_latest_dtm(files):
    '''
    Given a list of file names, return the most recent DTM of all of them
    '''

    latest = None
    for file in files:
        dtm = os.path.getmtime(file)
        logger.debug('File %s, dtm: %s', file, dtm)
        if latest is None or dtm > latest:
            latest = dtm

    logger.debug('Latest dnt is %s', latest)
    return latest


def build_archive(archive, d, force):
    '''
    Create or refresh an individual archive for date 'd'
    '''

    # Substitute 'd' into the supplied sources and destination
    source_pattern = archive['source_pattern'].format(date=d)
    logger.debug('Build archive source pattern: %s', source_pattern)

    destination = archive['destination'].format(date=d)
    logger.debug('Build archive destination: %s', destination)

    zip_dest = os.path.join(DEST_DIR, destination + '.zip')
    arcname = os.path.basename(destination) + '.csv'
    source_files = sorted(glob.glob(os.path.join(SOURCE_DIR, source_pattern)))

    work_to_do = False

    if len(source_files) == 0:
        # Positively don't want an archive if there aren't any files
        logger.debug('No files to process')
        try:
            os.remove(zip_dest)
            logger.info('Deleted %s', zip_dest)
        except FileNotFoundError:
            pass
    else:
        logger.debug('Files to process: %s', len(source_files))
        if os.path.exists(zip_dest):
            # Re-create existing archive if force or the archive is older than at least one source
            if force:
                logger.info('Force refreshing %s', zip_dest)
                work_to_do = True
            else:
                source_dtm = get_latest_dtm(source_files)
                dest_dtm = os.path.getmtime(zip_dest)
                logger.debug('source dtm: %s, dest_dtm: %s', source_dtm, dest_dtm)
                if source_dtm > dest_dtm:
                    logger.info('Refreshing %s', zip_dest)
                    work_to_do = True
        else:
            # Create a missing archive
            logger.info('Creating %s', zip_dest)
            work_to_do = True

    if work_to_do:
        logger.debug('Writing: %s', zip_dest)
        # Write CSV to a temporary file because you can't stream into a zip file
        with NamedTemporaryFile(mode='w', newline='') as csvfile:
            writer = csv.writer(csvfile, dialect='excel')

            # Retrieve the archive's extractor fn from the 'extractors' module
            # and run it
            extractor = get_function(archive['extractor'])
            extractor(source_files, writer)
            csvfile.flush()

            # Make the destination directory if missing
            dir = os.path.dirname(zip_dest)
            if dir:
                os.makedirs(dir, exist_ok=True)

            # Create the zip file under a temporary name, add the csv file to it
            pid = '-' + str(os.getpid())
            with ZipFile(zip_dest + pid, mode='w', compression=ZIP_DEFLATED) as zip:
                zip.write(csvfile.name, arcname=arcname)

            # Move the new zip file into place
            os.rename(zip_dest + pid, zip_dest)


def delete_archive(archive, d):
    '''
    Delete an individual archive dor date 'd' if it exists
    '''

    destination = archive['destination'].format(date=d)
    logger.debug('Delete archive, destination: %s', destination)

    zip_dest = os.path.join(DEST_DIR, destination + '.zip')

    try:
        os.remove(zip_dest)
        logger.info('Deleted %s', zip_dest)
    except FileNotFoundError:
        pass


def process_feed(feed, force):
    '''
    Process an individual feed
    '''

    logger.debug('Processing %s feed', feed['name'])

    # All of the feed's archives...
    if 'archives' in feed:
        for archive in feed['archives']:

            logger.debug('Processing %s archive', archive['name'])

            # Start date for the archives: the archive's 'start' date,
            # failing that 1 Jan in the feed's first_year
            start = (TODAY - relativedelta(**archive['start']) if 'start' in archive
                     else date(feed['first_year'], 1, 1))
            # End date for the archives: the archive's 'end' date,
            # failing that yesterday
            end = (TODAY - relativedelta(**archive['end']) if 'end' in archive
                   else TODAY - relativedelta(days=1))

            # Loop from 1 Jan in the feed's first_year to yesterday by
            # the archive's 'step'. Build or delete archives depending
            # on where we are relative to 'start' and 'end'
            step = relativedelta(**archive['step'])
            d = date(feed['first_year'], 1, 1)
            while d + step <= TODAY:
                if d >= start and d <= end:
                    build_archive(archive, d, force)
                else:
                    delete_archive(archive, d)
                d += step

    # ...and build the metadata
    if 'metadata' in feed:
        build_archive(feed['metadata'], None, force)


def process_feeds(feed_list, force):
    '''
    Process all the feeds
    '''

    for feed in settings.DOWNLOAD_FEEDS:
        logger.debug('Considering %s', feed['name'])
        # If we have a list of feeds then only process those
        if feed_list:
            if feed['name'] in feed_list:
                process_feed(feed, force)
        # Otherwise, process every feed with 'archive_by_default': True
        else:
            if feed.get('archive_by_default'):
                process_feed(feed, force)


class Command (BaseCommand):
    help = '(re-)build the archive files used by the download API'

    def add_arguments(self, parser):

        # List of fed names
        feed_names = [f['name'] for f in settings.DOWNLOAD_FEEDS]
        parser.add_argument(
            'feed',
            nargs='*',
            help='Only process selected feeds (possibilities: ' + ', '.join(feed_names) + ')')

        # 'Force' flag
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force (re-)generation of archives',
        )

    def handle(self, *args, **options):
        try:
            process_feeds(options['feed'], options['force'])
        except KeyboardInterrupt:
            pass
