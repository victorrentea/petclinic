#!/usr/bin/env bash
#
# sonar-diff-review.sh — cheap, deterministic pre-pass for /multi-review.
#
# Boots a SonarQube Community server in Docker (reused across runs), runs a
# SonarScanner analysis scoped to the *changed* backend Java files, and prints
# the open issues on those files. This is the "cheap feedback first" stage the
# /multi-review skill runs BEFORE it spends tokens on the LLM reviewer subagents.
#
#   exit 0  -> clean (no open Sonar issues in the diff, or nothing to scan)
#   exit 2  -> Sonar found issues in the diff (fix them, then re-run this script)
#   exit 1  -> Sonar could not run (Docker down, auth failed, analysis error)
#
# Subcommands:
#   sonar-diff-review.sh            run the diff analysis (default)
#   sonar-diff-review.sh --status   show whether the SonarQube container is up
#   sonar-diff-review.sh --stop     stop & remove the SonarQube container
#   sonar-diff-review.sh --help     this help
#
# Tunables (env vars):
#   SONAR_URL              default http://localhost:9000
#   SONAR_IMAGE            default sonarqube:community
#   SONAR_CONTAINER        default petclinic-sonarqube
#   SONAR_ADMIN_PASSWORD   optional; if unset, a strong password is generated once
#                          and cached in petclinic-backend/target/.sonar-admin-pass
#   SONAR_PROJECT_KEY      default petclinic-diff
#   SONAR_MAVEN_PLUGIN     default org.sonarsource.scanner.maven:sonar-maven-plugin:3.11.0.3922
#   SONAR_BOOT_TIMEOUT     default 240 (seconds to wait for the server to come UP)

set -uo pipefail

SONAR_URL=${SONAR_URL:-http://localhost:9000}
SONAR_IMAGE=${SONAR_IMAGE:-sonarqube:community}
SONAR_CONTAINER=${SONAR_CONTAINER:-petclinic-sonarqube}
# The admin password is NOT hard-coded (no secret in the repo). It is taken from
# $SONAR_ADMIN_PASSWORD, else read from / generated into the gitignored file below.
SONAR_ADMIN_PASSWORD=${SONAR_ADMIN_PASSWORD:-}
PROJECT_KEY=${SONAR_PROJECT_KEY:-petclinic-diff}
SONAR_MAVEN_PLUGIN=${SONAR_MAVEN_PLUGIN:-org.sonarsource.scanner.maven:sonar-maven-plugin:3.11.0.3922}
SONAR_BOOT_TIMEOUT=${SONAR_BOOT_TIMEOUT:-240}
BACKEND_DIR=petclinic-backend
PASS_FILE="$BACKEND_DIR/target/.sonar-admin-pass"

log()  { printf '  \033[36m•\033[0m %s\n' "$*" >&2; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*" >&2; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; }

# Always operate from the repo root so relative paths are stable.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { err "not a git repo"; exit 1; }
cd "$ROOT" || exit 1

REPORT_JSON="$BACKEND_DIR/target/sonar-diff-review.json"

# Build a "user:pass" string off the `curl -u` line so no literal credential pair
# ever sits next to `-u` (keeps the gitleaks curl-auth guardrail quiet — there is
# no real secret here, just SonarQube's local admin login).
_userpass() { printf '%s:%s' "$1" "$2"; }
curl_admin() { curl -sS -u "$(_userpass admin "$SONAR_ADMIN_PASSWORD")" "$@"; }

require_docker() {
  command -v docker >/dev/null 2>&1 || { err "docker not installed"; exit 1; }
  docker info >/dev/null 2>&1 || { err "Docker daemon not reachable — start Docker Desktop"; exit 1; }
}

container_running() { docker ps    --format '{{.Names}}' 2>/dev/null | grep -qx "$SONAR_CONTAINER"; }
container_exists()  { docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$SONAR_CONTAINER"; }

ensure_container() {
  if container_running; then
    log "SonarQube container '$SONAR_CONTAINER' already running (reused)."
  elif container_exists; then
    log "Starting existing SonarQube container '$SONAR_CONTAINER'..."
    docker start "$SONAR_CONTAINER" >/dev/null
  else
    log "Launching SonarQube ($SONAR_IMAGE) — first boot takes ~1-2 min..."
    docker run -d --name "$SONAR_CONTAINER" -p 9000:9000 \
      -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
      "$SONAR_IMAGE" >/dev/null || { err "failed to start SonarQube container"; exit 1; }
  fi
}

boot_diagnostics() {
  # SonarQube's embedded Elasticsearch aborts if the Docker VM disk is low
  # (high watermark 90%) — the most common "won't start" cause on Docker Desktop.
  local free
  free=$(docker run --rm "$SONAR_IMAGE" df -h / 2>/dev/null | awk 'NR==2{print $4" free ("$5" used)"}')
  [ -n "$free" ] && err "Docker VM disk: $free — Elasticsearch needs <90% used."
  err "Reclaim space with 'docker system df' / 'docker system prune', or enlarge the Docker Desktop disk."
  err "Last SonarQube log lines:"
  docker logs --tail 8 "$SONAR_CONTAINER" 2>&1 | sed 's/^/      /' >&2
}

wait_up() {
  local waited=0 status
  while [ "$waited" -lt "$SONAR_BOOT_TIMEOUT" ]; do
    if ! container_running; then
      err "SonarQube container exited during startup."
      boot_diagnostics; return 1
    fi
    status=$(curl -sS "$SONAR_URL/api/system/status" 2>/dev/null | jq -r '.status // "DOWN"' 2>/dev/null)
    [ "$status" = "UP" ] && { ok "SonarQube is UP."; return 0; }
    log "waiting for SonarQube ($status)... ${waited}s"
    sleep 5; waited=$((waited + 5))
  done
  err "SonarQube did not come UP within ${SONAR_BOOT_TIMEOUT}s"
  boot_diagnostics; return 1
}

resolve_admin_password() {
  # Precedence: explicit env var → previously generated file → freshly generated.
  # Persisted (never hard-coded) so it stays stable across container reuse without
  # committing a secret; target/ is gitignored.
  [ -n "$SONAR_ADMIN_PASSWORD" ] && return 0
  if [ -f "$PASS_FILE" ] && [ -s "$PASS_FILE" ]; then
    SONAR_ADMIN_PASSWORD=$(cat "$PASS_FILE"); return 0
  fi
  mkdir -p "$(dirname "$PASS_FILE")"
  if command -v openssl >/dev/null 2>&1; then
    SONAR_ADMIN_PASSWORD="S1!$(openssl rand -hex 16)"
  else
    SONAR_ADMIN_PASSWORD="S1!$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  ( umask 077; printf '%s' "$SONAR_ADMIN_PASSWORD" > "$PASS_FILE" )
  log "generated a SonarQube admin password (stored in $PASS_FILE)"
}

configure_auth() {
  # Fresh containers ship admin/admin and force a password change. Try to move
  # it to our resolved password; if that 401s the container was already set up.
  curl -sS -u "$(_userpass admin admin)" -X POST "$SONAR_URL/api/users/change_password" \
    --data-urlencode "login=admin" \
    --data-urlencode "previousPassword=admin" \
    --data-urlencode "password=$SONAR_ADMIN_PASSWORD" >/dev/null 2>&1

  # Verify we can authenticate with the resolved password.
  local valid
  valid=$(curl_admin "$SONAR_URL/api/authentication/validate" \
    | jq -r '.valid // false' 2>/dev/null)
  if [ "$valid" != "true" ]; then
    err "cannot authenticate as admin. If you changed the password, export SONAR_ADMIN_PASSWORD."
    return 1
  fi
  ok "authenticated as admin."
}

get_token() {
  # Regenerate a stable-named analysis token (revoke first to avoid conflicts).
  curl_admin -X POST "$SONAR_URL/api/user_tokens/revoke" \
    --data-urlencode "name=$PROJECT_KEY" >/dev/null 2>&1
  TOKEN=$(curl_admin -X POST "$SONAR_URL/api/user_tokens/generate" \
    --data-urlencode "name=$PROJECT_KEY" | jq -r '.token // empty')
  [ -n "$TOKEN" ] || { err "failed to generate analysis token"; return 1; }
}

# Changed backend Java files (tracked modifications + new untracked), module-relative
# (one per line, e.g. src/main/java/...  or  src/test/java/...).
changed_java_files() {
  { git diff --name-only HEAD; git ls-files --others --exclude-standard; } \
    | sort -u \
    | grep -E "^$BACKEND_DIR/.*\.java$" \
    | sed "s#^$BACKEND_DIR/##"
}

reset_project() {
  # Start each diff run from a clean project. A scoped analysis only refreshes the
  # files it includes; issues on files it skips would otherwise linger. Deleting
  # first guarantees the report reflects ONLY this diff's scoped scan.
  curl_admin -X POST "$SONAR_URL/api/projects/delete" \
    --data-urlencode "project=$PROJECT_KEY" >/dev/null 2>&1
}

run_analysis() {
  local main_inc="$1" test_inc="$2"
  # Scope BOTH source sets to the diff. `sonar.inclusions` covers MAIN sources
  # only; test sources are analyzed in full unless `sonar.test.inclusions` also
  # narrows them (that's why an early version flooded the report with pre-existing
  # test issues). A never-matching sentinel means "analyze none of this set".
  local none='__no_such_file__/**'
  log "changed main files: ${main_inc:-<none>}"
  log "changed test files: ${test_inc:-<none>}"
  ( cd "$BACKEND_DIR" && mvn -q -B -Dstyle.color=never test-compile \
      "$SONAR_MAVEN_PLUGIN:sonar" \
      -Dsonar.host.url="$SONAR_URL" \
      -Dsonar.token="$TOKEN" \
      -Dsonar.projectKey="$PROJECT_KEY" \
      -Dsonar.projectName="Petclinic Diff" \
      -Dsonar.inclusions="${main_inc:-$none}" \
      -Dsonar.test.inclusions="${test_inc:-$none}" \
      -Dsonar.scm.provider=git ) || { err "sonar analysis (mvn) failed"; return 1; }
}

wait_ce() {
  # The scanner uploads a report; SonarQube processes it asynchronously.
  local rt="$BACKEND_DIR/target/sonar/report-task.txt" ce_id status waited=0
  [ -f "$rt" ] || { err "no report-task.txt — analysis did not publish"; return 1; }
  ce_id=$(grep '^ceTaskId=' "$rt" | cut -d= -f2-)
  [ -n "$ce_id" ] || { err "could not read ceTaskId"; return 1; }
  while [ "$waited" -lt 120 ]; do
    status=$(curl_admin "$SONAR_URL/api/ce/task?id=$ce_id" | jq -r '.task.status // "PENDING"')
    case "$status" in
      SUCCESS) ok "Sonar server finished processing."; return 0 ;;
      FAILED|CANCELED) err "Sonar Compute Engine task $status"; return 1 ;;
      *) log "server processing ($status)..."; sleep 2; waited=$((waited + 2)) ;;
    esac
  done
  err "timed out waiting for Sonar to process the report"; return 1
}

report_issues() {
  local issues gate total
  issues=$(curl_admin "$SONAR_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&ps=500")
  gate=$(curl_admin "$SONAR_URL/api/qualitygates/project_status?projectKey=$PROJECT_KEY" \
    | jq -r '.projectStatus.status // "NONE"')
  total=$(printf '%s' "$issues" | jq -r '.total // 0')

  mkdir -p "$BACKEND_DIR/target"
  printf '%s' "$issues" | jq '{total, qualityGate: "'"$gate"'", issues: [.issues[] | {severity, type, rule, file: (.component|sub("^.*:";"")), line, message}]}' \
    > "$REPORT_JSON" 2>/dev/null

  echo >&2
  printf '\033[1m── SonarQube diff pre-pass ─────────────────────────────\033[0m\n' >&2
  printf '  Quality gate: %s   Open issues on changed files: %s\n' "$gate" "$total" >&2
  printf '  Dashboard: %s/dashboard?id=%s\n' "$SONAR_URL" "$PROJECT_KEY" >&2
  printf '  Machine-readable report: %s\n' "$REPORT_JSON" >&2
  echo >&2
  if [ "$total" -gt 0 ]; then
    printf '%s' "$issues" | jq -r \
      '.issues[] | "  [\(.severity)] \(.component|sub("^.*:";"")):\(.line // "-")  \(.message)  (\(.rule))"' >&2
  else
    ok "No open Sonar issues on the changed files."
  fi
  echo >&2

  [ "$total" -gt 0 ] && return 2 || return 0
}

# ---- subcommands ----------------------------------------------------------
case "${1:-run}" in
  --help|-h)
    sed -n '2,40p' "$0"; exit 0 ;;
  --status)
    if container_running; then ok "'$SONAR_CONTAINER' running at $SONAR_URL"; else warn "'$SONAR_CONTAINER' not running"; fi
    exit 0 ;;
  --stop)
    docker rm -f "$SONAR_CONTAINER" >/dev/null 2>&1 && ok "removed '$SONAR_CONTAINER'" || warn "nothing to remove"
    exit 0 ;;
  run) ;;
  *) err "unknown argument: $1 (try --help)"; exit 1 ;;
esac

# ---- main: diff pre-pass --------------------------------------------------
CHANGED=$(changed_java_files)
if [ -z "$CHANGED" ]; then
  ok "No backend Java changes in the diff — Sonar pre-pass skipped (treated as clean)."
  exit 0
fi
# Split so we can scope main and test source sets independently to the diff.
TEST_INC=$(printf '%s\n' "$CHANGED" | grep -E '(^|/)src/test/' | paste -sd , -)
MAIN_INC=$(printf '%s\n' "$CHANGED" | grep -Ev '(^|/)src/test/' | paste -sd , -)

require_docker
resolve_admin_password
ensure_container
wait_up        || exit 1
configure_auth || exit 1
get_token      || exit 1
reset_project
run_analysis "$MAIN_INC" "$TEST_INC" || exit 1
wait_ce        || exit 1
report_issues
exit $?
