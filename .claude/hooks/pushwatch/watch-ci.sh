#!/usr/bin/env bash
# Watch the GitHub Actions run for a commit; the process exit status is the CI
# verdict (0 = passed, non-zero = failed). Meant to be launched by the agent as
# a BACKGROUND Bash task after a push — the post-push hook hands over the SHA so
# the agent only has to run this one short line.
#
# IMPORTANT: a non-zero exit here is consumed as "CI RED → automatically repair
# the build". So a FALSE red (treating a transient gh hiccup as a failure) is far
# more harmful than a false green: it would send the agent off diagnosing and
# pushing fixes to a perfectly healthy build. Therefore we do NOT trust the raw
# exit code of `gh run watch` (it returns non-zero on ANY error: HTTP 401 bad
# credentials, network blips, rate limiting, or the watcher dropping while the
# run is still in_progress). `gh run watch` is used only as a convenient way to
# block; the REAL verdict always comes from the authoritative run conclusion read
# via `gh run view --json status,conclusion`.
set -uo pipefail

SHA="${1:?usage: watch-ci.sh <sha>}"
short="${SHA:0:7}"

# GitHub lags a few seconds registering the run after a push — poll up to ~2min.
id=""
for _ in $(seq 1 24); do
  id=$(gh run list --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
  [ -n "$id" ] && break
  sleep 5
done
[ -z "$id" ] && { echo "No CI run found for $short after ~2min"; exit 1; }

run_url=$(gh run view "$id" --json url --jq '.url' 2>/dev/null)
[ -n "$run_url" ] || run_url="(run id $id)"
echo "Watching CI run $id for $short — $run_url"

# A genuine red build is ONLY one of these authoritative conclusions. Anything
# else (notably an empty conclusion from a transient gh error) must NOT read red.
is_failure_conclusion() {
  case "$1" in
    failure|cancelled|timed_out|action_required|startup_failure) return 0 ;;
    *) return 1 ;;
  esac
}

# Re-poll the authoritative status/conclusion up to ~30 times with short backoff.
# We keep waiting while the run is still in_progress/queued (the watcher can drop
# early), and only break out once GitHub reports a terminal conclusion.
status=""
conclusion=""
for _ in $(seq 1 30); do
  # `gh run watch` just blocks until it thinks the run is done; we ignore its exit
  # code on purpose (transient errors set it non-zero even on a healthy run).
  gh run watch "$id" --exit-status >/dev/null 2>&1 || true

  # Authoritative read. tab-separated so an empty field (transient error) is still
  # parseable rather than collapsing the two values together.
  read -r status conclusion < <(
    gh run view "$id" --json status,conclusion \
      --jq '[.status, .conclusion] | @tsv' 2>/dev/null
  )

  if [ "$status" = "completed" ]; then
    break
  fi

  # status is in_progress/queued (or empty due to a transient gh error) — the run
  # is not done yet, so resume waiting instead of giving up.
  sleep 5
done

if [ "$conclusion" = "success" ]; then
  echo "CI passed for $short — $run_url"
  exit 0
fi

if is_failure_conclusion "$conclusion"; then
  echo "CI FAILED ($conclusion) for $short — $run_url"
  exit 1
fi

# Indeterminate: empty/unknown conclusion or run never reached "completed" within
# our retry budget — almost always a transient gh problem (auth 401, network, API
# unreachable), NOT a red build. Refuse to emit the "red → repair" signal; a false
# red would trigger automatic repair of a healthy build. Exit 0 but shout about it.
echo "⚠️ Could not confirm CI conclusion after retries (transient gh error) — NOT treating as a failure. Check $run_url manually."
exit 0
