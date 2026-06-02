#!/bin/bash
# Plays escalating sound reminders when Claude is waiting for a response.
# Phase 1: once at 1 minute   (soft Tink)
# Phase 2: once at 30 seconds (2x Ping)
# Phase 3: every 20 seconds   (3x Glass) until 5 minutes total, then stops.

PID_FILE=/tmp/claude_reminder.pid

# Kill any leftover reminder from the previous turn
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
fi

(
  START=$(date +%s)

  # Phase 1 – first nudge at 60 s
  sleep 60
  afplay /System/Library/Sounds/Tink.aiff 2>/dev/null

  # Phase 2 – more urgent at +30 s (2 beeps)
  sleep 30
  afplay /System/Library/Sounds/Ping.aiff 2>/dev/null
  sleep 0.3
  afplay /System/Library/Sounds/Ping.aiff 2>/dev/null

  # Phase 3 – every 20 s (3 beeps) until the 5-minute mark
  while true; do
    sleep 20
    [ $(( $(date +%s) - START )) -ge 300 ] && break
    for _ in 1 2 3; do
      afplay /System/Library/Sounds/Glass.aiff 2>/dev/null
      sleep 0.3
    done
  done
) &

echo $! > "$PID_FILE"
