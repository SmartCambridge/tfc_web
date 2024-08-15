# Transport (bus) commands

These are the `manage.py` commands launched from crontab to update the stops and timetables data.

## update_bus_stops.py

```
cd ~/tfc_web/tfc_web
python3 manage.py update_bus_stops
```

Runs for approx 2 hours.

Downloads UK national stops data from 

```
https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv
```

## update_bus_info.py
```
cd ~/tfc_web/tfc_web
python3 manage.py update_bus_info
```

FTP's data from `ftp.tnds.basemap.co.uk/<zone>.zip` where zones and user info given in settings.

Latest update can be checked with `update_bus_info --status`.

Other options are available (see source) incl. manually loading a single XML file.
