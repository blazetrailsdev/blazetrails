#!/bin/bash
# Wrapper for cron-triggered stats sync.
# Runs --latest, retries once on rate-limit failure, emails on failure.
set -euo pipefail

PROJ_DIR="/home/dean/github/blazetrailsdev/trails"
LOG_DIR="/home/dean/github/blazetrailsdev"
LOG="$LOG_DIR/stats-sync.log"
EMAIL="here@dean.is"

cd "$PROJ_DIR"

echo "=== $(date -u -Iseconds) ===" >> "$LOG"

send_alert() {
  local subject="$1"
  local body="$2"
  printf 'To: %s\nSubject: %s\n\n%s\n' "$EMAIL" "$subject" "$body" \
    | msmtp "$EMAIL"
}

# Run sync, capture output + exit code
output=$(npx tsx scripts/sync-stats/sync.ts --latest 2>&1) || true
echo "$output" >> "$LOG"

# Check for rate limit failures
rate_limit_hits=$(echo "$output" | grep -c "Rate limited" || true)
failed_count=$(echo "$output" | grep -c "Failed to fetch" || true)

# If rate limited, wait 2 min and retry once
if [ "$rate_limit_hits" -gt 0 ]; then
  echo "[cron-wrapper] Hit $rate_limit_hits rate limits, waiting 120s and retrying..." >> "$LOG"
  sleep 120
  retry_output=$(npx tsx scripts/sync-stats/sync.ts --latest 2>&1) || true
  echo "$retry_output" >> "$LOG"
  retry_failures=$(echo "$retry_output" | grep -c "Failed to fetch" || true)
  if [ "$retry_failures" -gt 5 ]; then
    send_alert "[stats-sync] $retry_failures failures after retry" \
      "Retry still had $retry_failures failures after rate-limit cooldown.

Last 30 lines:
$(echo "$retry_output" | tail -30)"
  fi
elif [ "$failed_count" -gt 5 ]; then
  send_alert "[stats-sync] $failed_count fetch failures" \
    "$failed_count fetch failures (no rate limit detected).

Last 30 lines:
$(echo "$output" | tail -30)"
fi

# Log final DB counts
db_summary=$(sqlite3 "$LOG_DIR/stats.db" "SELECT 'PRs: ' || COUNT(*) FROM pull_requests; SELECT 'Runs: ' || COUNT(*) FROM workflow_runs; SELECT 'Logs: ' || COUNT(*) FROM raw_job_logs; SELECT 'Compare: ' || COUNT(DISTINCT merge_commit_sha) FROM test_compare_stats;")
echo "$db_summary" >> "$LOG"
echo "" >> "$LOG"
