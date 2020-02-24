SmartCambridge Download API
===========================

The 'Download API' is a framework that provides efficient download
access to potentially large amounts of archived SmartCambridge data as
compressed CSV files. It compliments the Django REST framework-based
'Program API' and works by pre-building zipped CSV files containing
extracts of the available data for various date ranges and serving them
direct from Nginx.

Components
==========

The framework consists of:

1. The Django configuration item `DOWNLOAD_FEEDS` that defines which
archives should be maintained and made available.

2. The Django management command `build_download_data`
(`tfc_web/api/management/commands/build_download_data.py`) which
creates, updates (and occasionally deletes) zip'ed CSV files containing
extracts of SmartCambridge data, based on the configuration in
`DOWNLOAD_FEEDS`. It is largely idempotent (like `make`) so each time it
is run it just updates the collection of archive files as needed. This
command should be run once per day from `tfc_web`'s crontab.

2. Directories within `/media/tfc/` (currently `download_api/` and `download_private/`)
where the built archive files are stored.

3. Nginx configuration from `/etc/nginx/includes2/tfc_web.conf` (source
in `nginx/includes2/tfc_web.conf` in the tfc_prod repository) that makes
the files in `/media/tfc/download_api/` (but not `download_private`) available under
`https://smartcambridge.org/api/download_files/` but only to people who
have registered on the platform, authenticate to the Django app and
agreed to the platform T&Cs.

3. Other Django components in the 'api' app (`tfc_web/api/`, including
`download()` and `download_schema()` in
`views.py`, `templates/api/download.html`,
`templates/api/*-schema.html`) that present the page at
[https://smartcambridge.org/api/download/](https://smartcambridge.org/api/download/)
which provides an index to available downloadable files.

Configuration
=============

The Django configuration item `DOWNLOAD_FEEDS` contains a sequence of
dictionaries, each corresponding to a 'feed' of data to make available.

Feed configurations
-------------------

Each feed dictionary contain the following keys:

`name`: A short name or tag for this feed. Used in log records, directory names and URLs.

`title`: A human-readable title for this feed. Used as a title on the
index web page.

`desc`: A longer description of this feed. Displayed on the index web
page.

`archive_by_default`: Optional. If present and `True`, archives for this
feed are processed when `build_download_data` is run without an explicit
list of feeds.

`display`: Optional. If present and `True`, this feed is listed on the
index web page. Setting this to `False` won't prevent people accessing
any archives that exist in `/media/tfc/download_api/` for this feed if
they know or can guess the URL, it just means they won't be listed. It's
conventional to use `/media/tfc/download_private/` for archives that
should be maintained but not served over the web.

`first_year`: The earliest year for which this feed contains data. Only
data dated between 1 January in this year and yesterday will be
processed.

`destination`: The directory relative to the Django configuration
item `DEST_DIR` (defaulting to the configuration
item `DATA_PATH` which is typically `/media/tfc`)
within which archive and metadata files are written.

`archives`: Optional. If present, must be a sequence of dictionaries
containing archive configurations.

`metadata`: Optional. If present, must be a sequence of dictionaries
containing metadata configurations.

Archive and metadata configurations
-----------------------------------

The configuration for archives and metadata is similar. The significant
difference between the two is that each 'archive' entries create multiple,
time-bounded files (annual archives, monthly archives, etc.)
while each 'metadata' entry creates a single file. The dictionaries contain
the following keys:

`name`: A short name or tag for this archive. Used in log records.

`title`: A human-readable title. Used as a title on the
index web page.

`source_pattern`: A filesystem path relative to the Django configuration
item `DATA_PATH` (typically `/media/tfc`) that selects data files to be
processed for inclusion in an archive or metadata. The pattern can containing file
system glob wild-cards which will be expanded. For archives (but not metadata)
the pattern is also processed
by `string.format()` with a parameter `date` that contains the start
date for the period being processed. As a result `{date:%Y}` will, for
example, be replaced by the relevant year. An annual archive might have
a `source_pattern` like `cam_aq/data_bin/{date:%Y}/*/*/*.json`.

`destination_filename`: The name of the file to which data is written (omiting the '.zip' suffix).
The file will be stored in a directory named after
the coresponding feed's `name`, within the feeds `destination`, within the
Django configuration item `DEST_DIR` (defaulting to `DATA_PATH` and typically `/media/tfc`).
For archives (but not metadata files) the name is processed by
`string.format()` as for `source_pattern`.

`extractor`: A dot-separated Python path identifying the 'extractor'
function responsible for extracting data for this archive from the
source files and loading it into CVS (see below for details). Extractors
are normally stored in `tfc_web/api/extractors/*.py`.

`step`: The time step between successive archives, expressed as named
parameters for
[`dateutil.relativedelta.relativedelta()`](https://dateutil.readthedocs.io/en/stable/relativedelta.html).
For example `{'years': 1}` for an annual archive.

`start`: Optional. The first day for which an archive file should be
exist, relative to today and expressed as named parameters for
[`dateutil.relativedelta.relativedelta()`](https://dateutil.readthedocs.io/en/stable/relativedelta.html).
So for example `{'year': 1960', 'month': 3, 'day': 5}` represents
1960-03-05, `{'year': -1'}` represents today's date date last year and
`{day': 1}` represents the first day of the current month. Defaults to 1
January on the feed's `start_date`. Any existing archive files between 1
January on the feed's `start_date` and the value of `start` will be
deleted.

`end`: Optional. The last day for which an archive file should exist,
expressed as above for `start`. Defaults to yesterday. Any existing
archive files between `end` and yesterday will be deleted.

`build_download_data`
=====================

By default, `build_download_data` manages archives for all feeds with
`archive_by_default` set to `True`. Alternatively a list of one or more
feeds to manage can be supplied on the command line.

In managing archives, `build_download_data` will create any that are
missing, update any for which there are source files with later
modification dates than the corresponding archive, and delete any for
which there is no data or which correspond to dates before the archive's
`start` or after its `end`. The command-line option `--force` will force
all existing archives to be updated irrespective of dates.

`build_download_data` obtains a lock file for each feed it tries to process
and will skip processing any feeds for which the lock is already in use.
This prevents accidentally having two or more instances of the program
processing the same feed at the same time.

Extractor functions
===================

`build_download_data` uses 'extractor' functions to extract and format
data from each feed's data files. These can appear anywhere in the
Python include path but typically in a file named after the
corresponding feed name in `tfc_web/aq/extractors` - e.g.
`tfc_web/aq/extractors/parking.py`. Most feeds need a pair of
extractors - one for the data itself and one for the feed metadata from
`/media/tfc/sys/` - but this can vary (the 'aq' feed has two data
extractors, for example, the 'bus' feed has no metadata, and the 'btjourneys'
feed creates two metadata files from dynamic data rather than
static data in `/media/tfc/sys/`).

Extractor functions receive a list of names of files to
process and a Python CSV writer object as parameters. Their return value
is ignored. They are expected to write a header row to the CSV writer
and then to extract information from each file, manipulate it as needed,
and write it to the CSV writer.

See the `parking.py` extractor for a straight-forward example.

Adding a new data source
========================

Making a new data feed downloadable unfortunately needs changes in
several places (blame the system designer):

1. Create 'extractor' functions for the data and/or metadata

2. Edit `settings.py` and add a new element to `DOWNLOAD_FEEDS` to
represent the new feed. Set `display` to `False` until you are ready to
publish the data. You may also want to set `archive_by_default` to
`False` initially.

3.  Run `./manage.py build_download_data <feed name>` by hand and confirm
that appropriate archives are created.

4. Optionally add a file in `tfc_web/api/templates/api/` called `<feed
name>-schema.html` containing a description of the data and its format
(column names, units, etc).

   Set `display` to `True` and confirm that
[https://smartcambridge.org/api/download/](https://smartcambridge.org/api/download/)
displays the feed as expected.

6. Set `archive_by_default` to `True` to enable automatic maintenance of the
archives into the future.
