#!/bin/bash

source /home/tfc_prod/tfc_web_venv/bin/activate
if [[ -f /home/tfc_prod/tfc_web_envvars ]]; then
    source /home/tfc_prod/tfc_web_envvars
    echo 'Setting custom environmnt from /home/tfc_prod/tfc_web_envvars'
fi

cd /home/tfc_prod/tfc_web/tfc_web

echo $(date) "gunicorn started " >> /var/log/tfc_prod/gunicorn.log

nohup gunicorn --config /home/tfc_prod/tfc_web/gunicorn_config.py tfc_web.wsgi & disown

# Tell prometheus
prom_dir=/var/lib/node_exporter/textfile_collector
if [ -d "${prom_dir}" ]; then
    prom_file="${prom_dir}/tfc_web_redeploy.prom"
    echo "tfc_event{event=\"tfc_web_run\"} $(date +%s)" > ${prom_file}.$$
    mv ${prom_file}.$$ ${prom_file}
fi
