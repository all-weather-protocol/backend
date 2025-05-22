#!/bin/sh
echo "$GCP_SA_KEY_BASE64" | base64 -d > /usr/src/app/service-account.json
exec "$@"