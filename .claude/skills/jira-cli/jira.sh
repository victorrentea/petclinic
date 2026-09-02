#!/usr/bin/env bash
# jira.sh - talk to a JIRA Server / Data Center (or Cloud) instance from the shell.
# Built for environments where MCP servers are disabled by corporate policy.
# Dependencies: bash 3.2+, curl, jq.
set -euo pipefail

PROG=$(basename "$0")

# ---------------------------------------------------------------- config ----

# Load credentials from the first env file that exists. Keeping them in $HOME
# (not in the repo) is what makes the same PAT reusable across projects.
load_env() {
  local candidates=()
  [[ -n ${JIRA_ENV_FILE:-} ]] && candidates+=("$JIRA_ENV_FILE")
  candidates+=("$PWD/.jira.env" "$HOME/.claude/jira.env" "$HOME/.jira.env")
  local f
  for f in "${candidates[@]}"; do
    if [[ -f $f ]]; then
      JIRA_ENV_FILE_USED=$f
      set -o allexport
      # shellcheck disable=SC1090
      source "$f"
      set +o allexport
      return 0
    fi
  done
  JIRA_ENV_FILE_USED=""
}

die() { echo "$PROG: $*" >&2; exit 1; }

require_config() {
  [[ -n ${JIRA_URL:-} ]] || die "JIRA_URL is not set. See '$PROG config' for where to put it."
  JIRA_URL=${JIRA_URL%/}
  if [[ -n ${JIRA_PAT:-} ]]; then
    JIRA_DEPLOYMENT=${JIRA_DEPLOYMENT:-server}
  elif [[ -n ${JIRA_USER:-} && -n ${JIRA_API_TOKEN:-} ]]; then
    JIRA_DEPLOYMENT=${JIRA_DEPLOYMENT:-cloud}
  else
    die "no credentials: set JIRA_PAT (Server/DC) or JIRA_USER + JIRA_API_TOKEN (Cloud)."
  fi
  # Server/DC speaks REST v2 with plain-text descriptions; Cloud v3 wants ADF,
  # so we deliberately stay on v2 there too unless the caller overrides it.
  JIRA_API_VERSION=${JIRA_API_VERSION:-2}
  API="$JIRA_URL/rest/api/$JIRA_API_VERSION"
}

# ------------------------------------------------------------- http core ----

# api METHOD PATH [JSON_BODY] -> response body on stdout, non-zero exit on >=400
api() {
  local method=$1 path=$2 body=${3:-}
  local url
  case $path in
    http*) url=$path ;;
    /rest/*) url="$JIRA_URL$path" ;;
    *) url="$API/${path#/}" ;;
  esac

  local args=(-sS -X "$method" -H "Accept: application/json" -w '\n%{http_code}')
  [[ ${JIRA_SSL_VERIFY:-1} == 0 ]] && args+=(-k)
  if [[ -n ${JIRA_PAT:-} ]]; then
    args+=(-H "Authorization: Bearer $JIRA_PAT")
  else
    args+=(-u "$JIRA_USER:$JIRA_API_TOKEN")
  fi
  if [[ -n $body ]]; then
    args+=(-H "Content-Type: application/json" --data-binary "$body")
  fi

  local raw status payload
  raw=$(curl "${args[@]}" "$url") || die "curl failed for $method $url"
  status=${raw##*$'\n'}
  payload=${raw%$'\n'*}

  if [[ $status -ge 400 ]]; then
    local msg
    msg=$(printf '%s' "$payload" | jq -r '
      [(.errorMessages // [])[], (.errors // {} | to_entries[] | "\(.key): \(.value)")] | join("; ")
    ' 2>/dev/null || true)
    [[ -z $msg || $msg == "null" ]] && msg=$(printf '%s' "$payload" | head -c 500)
    die "HTTP $status on $method $url${msg:+ - $msg}"
  fi
  printf '%s' "$payload"
}

# Emit either the raw JSON (--json) or a jq-formatted human summary.
emit() {
  local json=$1 filter=$2
  if [[ $OUT_JSON == 1 ]]; then
    printf '%s\n' "$json" | jq .
  else
    printf '%s\n' "$json" | jq -r "$filter"
  fi
}

# --------------------------------------------------------- field builder ----

# Turns repeated --field flags into a JSON object.
#   --field summary=hello         -> {"summary": "hello"}
#   --field labels:='["a","b"]'   -> {"labels": ["a","b"]}   (:= means raw JSON)
FIELDS_JSON='{}'
add_field() {
  local spec=$1 key val
  if [[ $spec == *":="* ]]; then
    key=${spec%%:=*}; val=${spec#*:=}
    FIELDS_JSON=$(printf '%s' "$FIELDS_JSON" | jq --arg k "$key" --argjson v "$val" '.[$k] = $v')
  else
    [[ $spec == *"="* ]] || die "--field expects key=value or key:=json, got '$spec'"
    key=${spec%%=*}; val=${spec#*=}
    FIELDS_JSON=$(printf '%s' "$FIELDS_JSON" | jq --arg k "$key" --arg v "$val" '.[$k] = $v')
  fi
}

# Server/DC identifies users by name, Cloud by accountId.
user_ref() {
  local u=$1
  if [[ $JIRA_DEPLOYMENT == cloud ]]; then
    jq -n --arg u "$u" '{accountId: $u}'
  else
    jq -n --arg u "$u" '{name: $u}'
  fi
}

# Reads a text argument, or stdin when the argument is exactly "-".
text_arg() {
  if [[ ${1:-} == "-" ]]; then cat; else printf '%s' "${1:-}"; fi
}

# ------------------------------------------------------------- commands -----

ISSUE_SUMMARY_FILTER='
  "\(.key)  [\(.fields.status.name // "?")]  \(.fields.summary // "")",
  "  type=\(.fields.issuetype.name // "?")  assignee=\(.fields.assignee.displayName // .fields.assignee.name // "-")  reporter=\(.fields.reporter.displayName // .fields.reporter.name // "-")",
  "  labels=\((.fields.labels // []) | join(",") | if . == "" then "-" else . end)  priority=\(.fields.priority.name // "-")",
  (if (.fields.description // "") != "" then "\n\(.fields.description)" else empty end)
'

cmd_whoami() {
  local json; json=$(api GET myself)
  emit "$json" '"\(.displayName // .name)  <\(.emailAddress // "-")>  key=\(.key // .accountId // "-")"'
}

cmd_get() {
  local key=${1:?usage: $PROG get <ISSUE-KEY> [--fields a,b]}; shift || true
  local query=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --fields) query="?fields=$2"; shift 2 ;;
      *) die "unknown option for get: $1" ;;
    esac
  done
  local json; json=$(api GET "issue/$key$query")
  emit "$json" "$ISSUE_SUMMARY_FILTER"
}

cmd_search() {
  local jql=${1:?usage: $PROG search <JQL> [-n MAX] [--fields a,b]}; shift || true
  local max=50 fields="summary,status,assignee,issuetype,labels,priority"
  while [[ $# -gt 0 ]]; do
    case $1 in
      -n|--max) max=$2; shift 2 ;;
      --fields) fields=$2; shift 2 ;;
      *) die "unknown option for search: $1" ;;
    esac
  done

  # Page until we have `max` issues or JIRA runs out, so callers never silently
  # get truncated at the server's default page size.
  local start=0 page collected='[]' got total
  while :; do
    local want=$(( max - $(printf '%s' "$collected" | jq 'length') ))
    (( want <= 0 )) && break
    (( want > 100 )) && want=100
    local body
    body=$(jq -n --arg jql "$jql" --argjson s "$start" --argjson m "$want" --arg f "$fields" \
      '{jql: $jql, startAt: $s, maxResults: $m, fields: ($f | split(","))}')
    page=$(api POST search "$body")
    got=$(printf '%s' "$page" | jq '.issues | length')
    total=$(printf '%s' "$page" | jq '.total // 0')
    collected=$(jq -n --argjson a "$collected" --argjson b "$(printf '%s' "$page" | jq '.issues')" '$a + $b')
    start=$(( start + got ))
    (( got == 0 )) && break
    (( start >= total )) && break
  done

  local out
  out=$(jq -n --argjson i "$collected" --argjson t "${total:-0}" '{total: $t, issues: $i}')
  emit "$out" '
    "\(.total) issue(s) matched, showing \(.issues | length)",
    (.issues[] | "\(.key)  [\(.fields.status.name // "?")]  \(.fields.summary // "")  (\(.fields.assignee.displayName // .fields.assignee.name // "unassigned"))")
  '
}

cmd_create() {
  local project=${JIRA_DEFAULT_PROJECT:-} type="Task" summary="" description="" assignee="" parent=""
  local labels='[]'
  while [[ $# -gt 0 ]]; do
    case $1 in
      -p|--project) project=$2; shift 2 ;;
      -t|--type) type=$2; shift 2 ;;
      -s|--summary) summary=$(text_arg "$2"); shift 2 ;;
      -d|--description) description=$(text_arg "$2"); shift 2 ;;
      -a|--assignee) assignee=$2; shift 2 ;;
      -l|--label) labels=$(printf '%s' "$labels" | jq --arg l "$2" '. + [$l]'); shift 2 ;;
      --parent) parent=$2; shift 2 ;;
      -f|--field) add_field "$2"; shift 2 ;;
      *) die "unknown option for create: $1" ;;
    esac
  done
  [[ -n $project ]] || die "create needs --project (or JIRA_DEFAULT_PROJECT)"
  [[ -n $summary ]] || die "create needs --summary"

  local fields
  fields=$(jq -n --arg p "$project" --arg t "$type" --arg s "$summary" --argjson l "$labels" \
    '{project: {key: $p}, issuetype: {name: $t}, summary: $s} + (if ($l | length) > 0 then {labels: $l} else {} end)')
  [[ -n $description ]] && fields=$(printf '%s' "$fields" | jq --arg d "$description" '.description = $d')
  [[ -n $assignee ]] && fields=$(printf '%s' "$fields" | jq --argjson a "$(user_ref "$assignee")" '.assignee = $a')
  [[ -n $parent ]] && fields=$(printf '%s' "$fields" | jq --arg k "$parent" '.parent = {key: $k}')
  fields=$(jq -n --argjson a "$fields" --argjson b "$FIELDS_JSON" '$a * $b')

  local json; json=$(api POST issue "$(jq -n --argjson f "$fields" '{fields: $f}')")
  emit "$json" '"created \(.key)"'
}

cmd_update() {
  local key=${1:?usage: $PROG update <ISSUE-KEY> [--summary S] [--description D] [--field k=v]}; shift
  local summary="" description=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      -s|--summary) summary=$(text_arg "$2"); shift 2 ;;
      -d|--description) description=$(text_arg "$2"); shift 2 ;;
      -f|--field) add_field "$2"; shift 2 ;;
      *) die "unknown option for update: $1" ;;
    esac
  done
  local fields=$FIELDS_JSON
  [[ -n $summary ]] && fields=$(printf '%s' "$fields" | jq --arg s "$summary" '.summary = $s')
  [[ -n $description ]] && fields=$(printf '%s' "$fields" | jq --arg d "$description" '.description = $d')
  [[ $(printf '%s' "$fields" | jq 'length') -gt 0 ]] || die "update needs at least one field to change"
  api PUT "issue/$key" "$(jq -n --argjson f "$fields" '{fields: $f}')" >/dev/null
  echo "updated $key"
}

cmd_assign() {
  local key=${1:?usage: $PROG assign <ISSUE-KEY> <user|->}
  local who=${2:?usage: $PROG assign <ISSUE-KEY> <user|->}
  local ref
  if [[ $who == "-" ]]; then
    ref=$(jq -n '{name: null, accountId: null}')
  else
    ref=$(user_ref "$who")
  fi
  api PUT "issue/$key/assignee" "$ref" >/dev/null
  echo "assigned $key to $who"
}

cmd_comment() {
  local key=${1:?usage: $PROG comment <ISSUE-KEY> <text|->}; shift
  local text; text=$(text_arg "${1:-}")
  [[ -n $text ]] || die "comment body is empty"
  local json; json=$(api POST "issue/$key/comment" "$(jq -n --arg b "$text" '{body: $b}')")
  emit "$json" '"commented on '"$key"' (comment \(.id))"'
}

cmd_comments() {
  local key=${1:?usage: $PROG comments <ISSUE-KEY>}
  local json; json=$(api GET "issue/$key/comment")
  emit "$json" '
    .comments[] | "[\(.id)] \(.author.displayName // .author.name // "?")  \(.created // "")\n\(.body)\n"
  '
}

cmd_label() {
  local action=${1:?usage: $PROG label <add|rm|set> <ISSUE-KEY> <label...>}
  local key=${2:?usage: $PROG label <add|rm|set> <ISSUE-KEY> <label...>}
  shift 2
  [[ $# -gt 0 ]] || die "label needs at least one label"
  local body
  case $action in
    add|rm|remove)
      local op="add"; [[ $action != add ]] && op="remove"
      local ops='[]' l
      for l in "$@"; do
        ops=$(printf '%s' "$ops" | jq --arg op "$op" --arg l "$l" '. + [{($op): $l}]')
      done
      body=$(jq -n --argjson o "$ops" '{update: {labels: $o}}')
      ;;
    set)
      body=$(jq -n --args '{fields: {labels: $ARGS.positional}}' "$@")
      ;;
    *) die "label action must be add, rm or set (got '$action')" ;;
  esac
  api PUT "issue/$key" "$body" >/dev/null
  echo "labels $action on $key: $*"
}

cmd_transitions() {
  local key=${1:?usage: $PROG transitions <ISSUE-KEY>}
  local json; json=$(api GET "issue/$key/transitions")
  emit "$json" '.transitions[] | "\(.id)\t\(.name) -> \(.to.name // "?")"'
}

cmd_transition() {
  local key=${1:?usage: $PROG transition <ISSUE-KEY> <transition-or-status name>}
  local name=${2:?usage: $PROG transition <ISSUE-KEY> <transition-or-status name>}
  local list id
  list=$(api GET "issue/$key/transitions")
  # Match the transition name first, then fall back to the destination status.
  id=$(printf '%s' "$list" | jq -r --arg n "$name" '
    ([.transitions[] | select((.name // "") | ascii_downcase == ($n | ascii_downcase))]
      + [.transitions[] | select((.to.name // "") | ascii_downcase == ($n | ascii_downcase))]
    ) | first | .id // empty')
  if [[ -z $id ]]; then
    local avail; avail=$(printf '%s' "$list" | jq -r '[.transitions[].name] | join(", ")')
    die "no transition '$name' on $key. Available: ${avail:-none}"
  fi
  api POST "issue/$key/transitions" "$(jq -n --arg id "$id" '{transition: {id: $id}}')" >/dev/null
  echo "transitioned $key via '$name'"
}

cmd_link() {
  local from=${1:?usage: $PROG link <FROM-KEY> <link-type> <TO-KEY>}
  local type=${2:?usage: $PROG link <FROM-KEY> <link-type> <TO-KEY>}
  local to=${3:?usage: $PROG link <FROM-KEY> <link-type> <TO-KEY>}
  api POST issueLink "$(jq -n --arg t "$type" --arg f "$from" --arg to "$to" \
    '{type: {name: $t}, inwardIssue: {key: $f}, outwardIssue: {key: $to}}')" >/dev/null
  echo "linked $from -[$type]-> $to"
}

cmd_linktypes() {
  local json; json=$(api GET issueLinkType)
  emit "$json" '.issueLinkTypes[] | "\(.name)\t(inward: \(.inward), outward: \(.outward))"'
}

cmd_attach() {
  local key=${1:?usage: $PROG attach <ISSUE-KEY> <file>}
  local file=${2:?usage: $PROG attach <ISSUE-KEY> <file>}
  [[ -f $file ]] || die "no such file: $file"
  local args=(-sS -X POST -H "X-Atlassian-Token: no-check" -H "Accept: application/json" -w '\n%{http_code}')
  [[ ${JIRA_SSL_VERIFY:-1} == 0 ]] && args+=(-k)
  if [[ -n ${JIRA_PAT:-} ]]; then
    args+=(-H "Authorization: Bearer $JIRA_PAT")
  else
    args+=(-u "$JIRA_USER:$JIRA_API_TOKEN")
  fi
  local raw status payload
  raw=$(curl "${args[@]}" -F "file=@$file" "$API/issue/$key/attachments")
  status=${raw##*$'\n'}; payload=${raw%$'\n'*}
  [[ $status -ge 400 ]] && die "HTTP $status attaching $file: $(printf '%s' "$payload" | head -c 300)"
  emit "$payload" '.[] | "attached \(.filename) (id \(.id))"'
}

cmd_attachments() {
  local key=${1:?usage: $PROG attachments <ISSUE-KEY>}
  local json; json=$(api GET "issue/$key?fields=attachment")
  emit "$json" '.fields.attachment[]? | "\(.id)\t\(.filename)\t\(.size) bytes\t\(.content // "")"'
}

cmd_worklog() {
  local key=${1:?usage: $PROG worklog <ISSUE-KEY> <timeSpent> [comment]}
  local spent=${2:?usage: $PROG worklog <ISSUE-KEY> <timeSpent> [comment]}
  local note=${3:-}
  local body; body=$(jq -n --arg t "$spent" '{timeSpent: $t}')
  [[ -n $note ]] && body=$(printf '%s' "$body" | jq --arg c "$note" '.comment = $c')
  api POST "issue/$key/worklog" "$body" >/dev/null
  echo "logged $spent on $key"
}

cmd_watch() {
  local key=${1:?usage: $PROG watch <ISSUE-KEY> [user]}
  local who=${2:-}
  local body="null"
  [[ -n $who ]] && body=$(jq -n --arg u "$who" '$u')
  api POST "issue/$key/watchers" "$body" >/dev/null
  echo "watching $key${who:+ as $who}"
}

cmd_watchers() {
  local key=${1:?usage: $PROG watchers <ISSUE-KEY>}
  local json; json=$(api GET "issue/$key/watchers")
  emit "$json" '.watchers[]? | "\(.displayName // .name)"'
}

cmd_delete() {
  local key=${1:?usage: $PROG delete <ISSUE-KEY> [--subtasks]}
  local q=""
  [[ ${2:-} == "--subtasks" ]] && q="?deleteSubtasks=true"
  api DELETE "issue/$key$q" >/dev/null
  echo "deleted $key"
}

cmd_projects() {
  local json; json=$(api GET project)
  emit "$json" '.[] | "\(.key)\t\(.name)"'
}

cmd_issuetypes() {
  local project=${1:?usage: $PROG issuetypes <PROJECT-KEY>}
  local json; json=$(api GET "issue/createmeta?projectKeys=$project&expand=projects.issuetypes")
  emit "$json" '.projects[]?.issuetypes[]? | "\(.name)\tsubtask=\(.subtask)"'
}

cmd_fields() {
  local grep_for=${1:-}
  local json; json=$(api GET field)
  emit "$json" "
    .[] | select((.name // \"\") | ascii_downcase | contains(\"$(printf '%s' "$grep_for" | tr '[:upper:]' '[:lower:]')\"))
        | \"\(.id)\t\(.name)\t\(.schema.type // \"?\")\"
  "
}

cmd_raw() {
  local method=${1:?usage: $PROG raw <GET|POST|PUT|DELETE> <path> [json-body]}
  local path=${2:?usage: $PROG raw <GET|POST|PUT|DELETE> <path> [json-body]}
  local body; body=$(text_arg "${3:-}")
  local json; json=$(api "$method" "$path" "$body")
  printf '%s\n' "$json" | jq .
}

cmd_config() {
  local auth="<none>"
  if [[ -n ${JIRA_PAT:-} ]]; then
    auth="PAT (Bearer, Server/DC)"
  elif [[ -n ${JIRA_USER:-} ]]; then
    auth="Basic as ${JIRA_USER} (Cloud)"
  fi
  cat <<EOF
Credentials are read from the first file found, in this order:
  1. \$JIRA_ENV_FILE            (currently: ${JIRA_ENV_FILE:-unset})
  2. ./.jira.env               (project-local override)
  3. ~/.claude/jira.env        <-- recommended: one PAT, reusable across all projects
  4. ~/.jira.env

Currently loaded: ${JIRA_ENV_FILE_USED:-<none>}
JIRA_URL=${JIRA_URL:-<unset>}
Auth: $auth
API base: ${API:-<unset>}

Create it with:
  install -m 600 /dev/null ~/.claude/jira.env
  \$EDITOR ~/.claude/jira.env

See jira.env.example next to this script for the full list of variables.
EOF
}

usage() {
  cat <<EOF
$PROG - JIRA from the shell (Server/DC via PAT, or Cloud via API token).

Read:
  whoami                              who the token belongs to
  get <KEY> [--fields a,b]            one issue
  search <JQL> [-n MAX] [--fields ..] JQL search, auto-paginated
  comments <KEY>                      all comments
  transitions <KEY>                   transitions available right now
  attachments <KEY>                   attachment list
  watchers <KEY>                      watcher list
  projects                            all projects
  issuetypes <PROJECT>                issue types creatable in a project
  fields [substring]                  field ids (find customfield_XXXXX)

Write:
  create -p PROJ -t Task -s "..." [-d "..."] [-l label]... [-a user] [--parent K] [-f k=v]
  update <KEY> [-s "..."] [-d "..."] [-f k=v]...
  assign <KEY> <user|->               '-' unassigns
  comment <KEY> <text|->              '-' reads the body from stdin
  label <add|rm|set> <KEY> <label...>
  transition <KEY> <name>             by transition name or target status name
  link <FROM> <type> <TO>             see 'linktypes'
  attach <KEY> <file>
  worklog <KEY> <timeSpent> [comment] e.g. worklog PET-1 2h "pairing"
  watch <KEY> [user] | delete <KEY> [--subtasks]

Escape hatch:
  raw <METHOD> <path> [json]          path relative to /rest/api/N, or absolute /rest/...

Global:
  --json      print the raw JSON response instead of the text summary
  config      show where credentials are read from
  -h|--help

Values for -f/--field: 'key=text' for a string, 'key:=<json>' for raw JSON
  e.g. -f customfield_10010=ACME  -f components:='[{"name":"api"}]'
EOF
}

# ----------------------------------------------------------------- main -----

OUT_JSON=0
ARGS=()
for a in "$@"; do
  if [[ $a == "--json" ]]; then OUT_JSON=1; else ARGS+=("$a"); fi
done
set -- ${ARGS[@]+"${ARGS[@]}"}

load_env
cmd=${1:-help}
[[ $# -gt 0 ]] && shift || true

case $cmd in
  -h|--help|help) usage; exit 0 ;;
  config) require_config 2>/dev/null || true; cmd_config; exit 0 ;;
esac

require_config

case $cmd in
  whoami) cmd_whoami "$@" ;;
  get) cmd_get "$@" ;;
  search) cmd_search "$@" ;;
  create) cmd_create "$@" ;;
  update) cmd_update "$@" ;;
  assign) cmd_assign "$@" ;;
  comment) cmd_comment "$@" ;;
  comments) cmd_comments "$@" ;;
  label) cmd_label "$@" ;;
  transitions) cmd_transitions "$@" ;;
  transition) cmd_transition "$@" ;;
  link) cmd_link "$@" ;;
  linktypes) cmd_linktypes "$@" ;;
  attach) cmd_attach "$@" ;;
  attachments) cmd_attachments "$@" ;;
  worklog) cmd_worklog "$@" ;;
  watch) cmd_watch "$@" ;;
  watchers) cmd_watchers "$@" ;;
  delete) cmd_delete "$@" ;;
  projects) cmd_projects "$@" ;;
  issuetypes) cmd_issuetypes "$@" ;;
  fields) cmd_fields "$@" ;;
  raw) cmd_raw "$@" ;;
  *) die "unknown command '$cmd'. Run '$PROG --help'." ;;
esac
