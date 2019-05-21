Test Data
=========

This directory contains a small amount of test data for the file-based
API, copied from the main SmartCambridge web site. It's stored here
to be accessible (as `/usr/src/app/api/tests/data`) from within the
Docker test container. `tfc_web.settings` points to this location by default
(but can be override by the `TFC_API_DATA_PATH` environment variable and is
set to `/media/tfc` in `tfc_web.settings_production`).

Only a very limited sub-set of data is available:

<dl>
    <dt>`sys/`</dt>
    <dd>Configuration for Air Quality, Parking, and Zones, and for the
        `cam_park_local` and `cam_park_rss` feeds.</dd>
    <dt>Air quality</dt>
    <dd>Air quality data for all sensors on S-1134 for 2017-01 only</dd>
    <dt>Parking</dt>
    <dd>Archived data for 2018-01-01, latest and previous-latest data for
        some time on 2018-06-19</dd>
    <dt>Zones</dt>
    <dd>Data for 2018-01-02 and 2018-09-01 (the latter including 
        'distance' and 'avg_speed' fields)</dd>
    <dt>TTN CSN</dt>
    <dd>Data for 2019-05-20 for the application cambridge-sensor-network
        and for devices 0000000000000000, 70B3D5A9F001BDDF, 70B3D5A9F001BDE7,
        763A53FFB342FBD8, 90DFFB81871882AE, 90DFFB8187188416, 90DFFB818718A037,
        A81758FFFE0366B0, and a single 'latest' data packet for application
        cambridge-sensor-network and device 763A53FFB342FBD8
</dl>
