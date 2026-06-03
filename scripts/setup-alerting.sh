#!/usr/bin/env bash
# setup-alerting.sh
#
# Creates a Cloud Monitoring alert policy for the processImportJob Cloud Function.
# Fires on: 5xx responses, function timeout, execution errors, high latency.
# Notification: email to salvo@jpmendes.com
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login)
#   - Project set (gcloud config set project YOUR_PROJECT_ID)
#   - Cloud Monitoring API enabled
#
# Run once after deploying processImportJob for the first time.
# Subsequent deploys do NOT re-run this script.
#
# Usage:
#   chmod +x scripts/setup-alerting.sh
#   ./scripts/setup-alerting.sh

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
ALERT_EMAIL="salvo@jpmendes.com"
FUNCTION_NAME="processImportJob"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Setting up Cloud Monitoring alerts for project: $PROJECT_ID"
echo "Alert email: $ALERT_EMAIL"
echo "Function: $FUNCTION_NAME"
echo ""

# ── 1. Create email notification channel ─────────────────────────────────────
echo "Creating email notification channel..."
CHANNEL_JSON=$(gcloud alpha monitoring channels create \
  --display-name="Salvô Admin Alert" \
  --type=email \
  --channel-labels="email_address=${ALERT_EMAIL}" \
  --format=json \
  --project="$PROJECT_ID")

CHANNEL_NAME=$(echo "$CHANNEL_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
echo "  Channel created: $CHANNEL_NAME"
echo ""

# ── 2. Alert policy: 5xx errors ───────────────────────────────────────────────
# Gen2 Cloud Functions run on Cloud Run; use run.googleapis.com metrics.
echo "Creating alert: 5xx errors on processImportJob..."
cat > /tmp/salvo-alert-5xx.json << EOF
{
  "displayName": "Salvô processImportJob — 5xx errors",
  "conditions": [
    {
      "displayName": "5xx response rate > 0",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"processimportjob\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_NAME}"],
  "alertStrategy": {
    "notificationRateLimit": { "period": "900s" }
  },
  "documentation": {
    "content": "processImportJob returned a 5xx response. Check Cloud Logging for details: https://console.cloud.google.com/logs/query?project=${PROJECT_ID}",
    "mimeType": "text/markdown"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/salvo-alert-5xx.json \
  --project="$PROJECT_ID"
echo "  5xx alert created."
echo ""

# ── 3. Alert policy: high latency (> 240s = 80% of 300s timeout) ─────────────
echo "Creating alert: high latency on processImportJob..."
cat > /tmp/salvo-alert-latency.json << EOF
{
  "displayName": "Salvô processImportJob — latency > 240s",
  "conditions": [
    {
      "displayName": "p99 latency > 240s",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"processimportjob\" AND metric.type=\"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_PERCENTILE_99",
            "crossSeriesReducer": "REDUCE_MAX"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 240000,
        "duration": "0s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_NAME}"],
  "alertStrategy": {
    "notificationRateLimit": { "period": "1800s" }
  },
  "documentation": {
    "content": "processImportJob p99 latency exceeded 240s (80% of 300s timeout). Risk of 504. Check Cloud Logging.",
    "mimeType": "text/markdown"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/salvo-alert-latency.json \
  --project="$PROJECT_ID"
echo "  Latency alert created."
echo ""

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -f /tmp/salvo-alert-5xx.json /tmp/salvo-alert-latency.json

echo "✓ Done. Alerts active for project: $PROJECT_ID"
echo "  View alerts: https://console.cloud.google.com/monitoring/alerting?project=${PROJECT_ID}"
echo ""
echo "NOTE: Run this script ONCE after the first deploy. Do not re-run."
