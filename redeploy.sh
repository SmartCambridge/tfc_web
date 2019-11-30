#!/bin/bash

set -e

# Bring whichever branch of tfc_web is currently checked out up to date,
# update any Python requirements, run any database migrations, collect
# static files, and re-start Gunicorn

# Run the following in a sub-shell to easily de-activate the venv

source "${HOME}/tfc_web_venv/bin/activate"

cd "${HOME}/tfc_web/"

# Fetch git updates, merge changes but abort if a fast-forward isn't possible
git fetch
git merge --ff-only

# Install any new Python modules
cd tfc_web
pip3 install -U -r requirements.txt

# Run migrations
./manage.py migrate

# Collect static files
./manage.py collectstatic --no-input

# Ask Gunicorn to restart by touching the settings file
# Touch all of them to make sure we get the right one!
touch tfc_web/settings*.py

echo "Deployed commit $(git rev-parse --short HEAD) on branch $(git rev-parse --abbrev-ref HEAD)" >&2
