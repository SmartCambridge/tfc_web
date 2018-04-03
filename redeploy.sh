#!/bin/bash

set -e

# Bring whichever branch of tfc_web is currently checked out up to date,
# update any Python requirements, run any database migrations, collect
# static files, and then stop and re-start Gunicorn

# Run the following in a sub-shell to easily de-activate the venv

(

  source ${HOME}/tfc_web_venv/bin/activate

  cd "${HOME}/tfc_web/"

  # Fetch git updates, merge changes but abort if a fast-forward isn't possible
  git fetch
  git merge --ff-only

  # Install any new Python modules
  cd tfc_web
  pip3 install -r requirements.txt

  # Run migrations
  ./manage.py migrate

  # Collect static files
  ./manage.py collectstatic --no-input

  # Exit the sub-shell

)

# Kill the Gunicorn instances running tfc_web

pids=$(ps -ef | grep gunicorn | grep tfc_web | awk '{ print $2 }')
if [ -n "${pids}" ]
then
    kill ${pids}
fi

sleep 1
pids=$(ps -ef | grep gunicorn | grep tfc_web | awk '{ print $2 }')
if [ -n "${pids}" ]
then
    echo "Gunicorn failed to stop - aborting" >&2
    exit 1
fi

# Run run.sh to restart Gunicorn

${HOME}/tfc_web/run.sh

sleep 1
pids=$(ps -ef | grep gunicorn | grep tfc_web | awk '{ print $2 }')
if [ -z "${pids}" ]
then
    echo "Gunicorn failed to restart - aborting" >&2
    exit 1
fi

echo "Gunicorn running, commit [$(git rev-parse --short HEAD)]" >&2
ps -ef | grep gunicorn | grep tfc_web >&2
