#!/usr/bin/env bash
# Ralph Loop: an AI agent implements an OpenSpec change, one chapter at a time.
#
#   while tasks.md still has unchecked boxes:
#     1. a fresh agent implements the next chapter and ticks its boxes
#     2. run the tests
#     3. green → commit      red → retry, showing the agent the errors (max 3)
#
# The agent forgets everything between rounds. tasks.md remembers.
#
# Usage:  ./ralph-openspec.sh owners-grid-pagination

CHANGE="$1"
TASKS="openspec/changes/$CHANGE/tasks.md"
TEST_LOG="/tmp/ralph-tests.log"
MAX_FAILURES=3

unchecked_tasks() {
  grep -c '^- \[ \]' "$TASKS"
}

tests_pass() {
  (cd petclinic-backend  && mvn -q test) &&
  (cd petclinic-frontend && npm run test-headless)
}

failures=0
feedback=""

while [ "$(unchecked_tasks)" -gt 0 ]; do
  before=$(unchecked_tasks)

  claude -p --automode --max-turns 60 "
    In $TASKS, take the FIRST chapter (## heading) that still has unchecked tasks.
    Implement ONLY that chapter, following AGENTS.md.
    proposal.md, design.md and specs/ next to tasks.md explain why and how.
    Tick each task when done: '- [ ]' becomes '- [x]'. Do not commit.
    $feedback"

  if [ "$(unchecked_tasks)" -lt "$before" ] && tests_pass > "$TEST_LOG" 2>&1; then
    git add -A
    git commit -q -m "ralph($CHANGE): chapter done, $(unchecked_tasks) tasks left"
    failures=0
    feedback=""
  else
    failures=$((failures + 1))
    [ "$failures" -ge "$MAX_FAILURES" ] && { echo "❌ Gave up after $MAX_FAILURES failures"; exit 1; }
    feedback="Your previous attempt failed: tasks not ticked, or tests red. Test output:
$(tail -40 "$TEST_LOG" 2>/dev/null)"
  fi
done

echo "🎉 $CHANGE is done"
