#!/bin/bash

# Run this script to sync the local repo to production

set -o xtrace # Print commands as they are executed
set -o errexit # Exit on error

# Makiig sure that we can acctually build
docker build -t find-peers .

SSH="ssh find-peers"

# If there are local changes, this will fail. It should be like that
$SSH 'cd /root/find-peers && git pull origin main'

$SSH '(cd /root/find-peers && docker compose up --build -d)'

echo Press Ctrl+C to stop following the logs
$SSH 'docker logs -f find-peers'
