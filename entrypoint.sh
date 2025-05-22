echo "$GCP_SA_KEY_BASE64" | base64 -d > /app/gcp-key.json
export GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
