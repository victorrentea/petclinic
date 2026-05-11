#!/usr/bin/env bash
# Rate-limit petclinic-db MCP queries to 1 per 10 seconds.
STAMP_FILE="/tmp/petclinic_db_last_query"
MIN_INTERVAL=10

now=$(date +%s)

if [[ -f "$STAMP_FILE" ]]; then
  last=$(cat "$STAMP_FILE")
  elapsed=$(( now - last ))
  if (( elapsed < MIN_INTERVAL )); then
    remaining=$(( MIN_INTERVAL - elapsed ))
    echo "Rate limit: petclinic-db allows 1 query every ${MIN_INTERVAL}s. Wait ${remaining}s more." >&2
    exit 2
  fi
fi

echo "$now" > "$STAMP_FILE"
exit 0
