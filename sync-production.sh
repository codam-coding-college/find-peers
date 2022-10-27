#!/bin/bash

# Run this script to sync the local repo to production

set -o strace # Print commands as they are executed
set -o errexit # Exit on error

SSH="ssh find-peers"

# If there are local changes, this will fail. It should be like that
$SSH 'cd /root/find-peers && git pull origin main'
$SSH 'docker build -t find-peers /root/find-peers'

$SSH 'docker stop find-peers'
$SSH 'docker rm find-peers'
$SSH 'docker run -v /root/find-peers/database:/app/database -d -p 80:8080 --name find-peers find-peers'

$SSH 'docker logs -f find-peers'
# Press Ctrl+C to stop following the logs
