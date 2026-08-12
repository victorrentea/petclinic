#!/usr/bin/env bash
# confluence.sh - talk to a Confluence Data Center / Server (or Cloud) instance
# from the shell. Sibling of jira-cli/jira.sh, same conventions, same env-file
# mechanism, built for environments where MCP servers are disabled by policy.
# Dependencies: bash 3.2+, curl, jq.
set -euo pipefail

PROG=$(basename "$0")

# ---------------------------------------------------------------- config ----

# Load credentials from the first env file that exists. Keeping them in $HOME
# (not in the repo) is what makes the same PAT reusable across projects.
load_env() {
  local candidates=()
  [[ -n ${CONFLUENCE_ENV_FILE:-} ]] && candidates+=("$CONFLUENCE_ENV_FILE")
  candidates+=("$PWD/.confluence.env" "$HOME/.claude/confluence.env" "$HOME/.confluence.env")
  local f
  for f in "${candidates[@]}"; do
    if [[ -f $f ]]; then
      CONFLUENCE_ENV_FILE_USED=$f
      set -o allexport
      # shellcheck disable=SC1090
      source "$f"
      set +o allexport
      return 0
    fi
  done
  CONFLUENCE_ENV_FILE_USED=""
}

die() { echo "$PROG: $*" >&2; exit 1; }

require_config() {
  [[ -n ${CONFLUENCE_URL:-} ]] || die "CONFLUENCE_URL is not set. See '$PROG config' for where to put it."
  CONFLUENCE_URL=${CONFLUENCE_URL%/}

  if [[ -n ${CONFLUENCE_PAT:-} ]]; then
    CONFLUENCE_FLAVOR=${CONFLUENCE_FLAVOR:-server}
  elif [[ -n ${CONFLUENCE_USER:-} && -n ${CONFLUENCE_API_TOKEN:-} ]]; then
    CONFLUENCE_FLAVOR=${CONFLUENCE_FLAVOR:-cloud}
  else
    die "no credentials: set CONFLUENCE_PAT (DC/Server) or CONFLUENCE_USER + CONFLUENCE_API_TOKEN (Cloud)."
  fi

  # Cloud serves Confluence under /wiki; DC serves it at the context root. Accept
  # a URL that already ends in /wiki so both spellings work.
  if [[ $CONFLUENCE_FLAVOR == cloud && $CONFLUENCE_URL != */wiki ]]; then
    WIKI="$CONFLUENCE_URL/wiki"
  else
    WIKI="$CONFLUENCE_URL"
  fi

  API1="$WIKI/rest/api"     # v1: the only API on DC, still the one with CQL search
  API2="$WIKI/api/v2"       # v2: Cloud only

  # Which API does page CRUD go through? On DC there is no choice. On Cloud v2 is
  # the future-proof one (v1 content endpoints are being withdrawn), but v2 has no
  # CQL search, no label writes and no attachment upload - those stay on v1.
  if [[ $CONFLUENCE_FLAVOR == cloud ]]; then
    PAGE_API=${CONFLUENCE_PAGE_API:-v2}
  else
    PAGE_API=${CONFLUENCE_PAGE_API:-v1}
  fi
  [[ $PAGE_API == v1 || $PAGE_API == v2 ]] || die "CONFLUENCE_PAGE_API must be v1 or v2 (got '$PAGE_API')"
  # Written as an `if` rather than `[[ ... ]] && die`, because a trailing guard
  # that evaluates false returns 1 and `set -e` would kill the script silently.
  if [[ $PAGE_API == v2 && $CONFLUENCE_FLAVOR == server ]]; then
    die "REST v2 is Cloud-only; Confluence DC/Server has no /api/v2."
  fi
}

# ------------------------------------------------------------- http core ----

curl_auth_args() {
  CURL_ARGS=(-sS -H "Accept: application/json")
  [[ ${CONFLUENCE_SSL_VERIFY:-1} == 0 ]] && CURL_ARGS+=(-k)
  if [[ -n ${CONFLUENCE_PAT:-} ]]; then
    CURL_ARGS+=(-H "Authorization: Bearer $CONFLUENCE_PAT")
  else
    CURL_ARGS+=(-u "$CONFLUENCE_USER:$CONFLUENCE_API_TOKEN")
  fi
}

# api METHOD PATH [JSON_BODY] -> response body on stdout, non-zero exit on >=400
#   path starting with http  -> used as-is
#   path starting with /rest -> resolved against the site (v1, absolute)
#   path starting with v2:   -> resolved against the v2 base
#   anything else            -> resolved against the v1 base
api() {
  local method=$1 path=$2 body=${3:-}
  local url
  case $path in
    http*) url=$path ;;
    v2:*) url="$API2/${path#v2:}" ;;
    # /wiki/... is already site-absolute on Cloud; /rest/... is relative to the
    # Confluence context root, which is the site on DC and /wiki on Cloud.
    /wiki/*) url="$CONFLUENCE_URL${path}" ;;
    /*) url="$WIKI$path" ;;
    *) url="$API1/$path" ;;
  esac

  curl_auth_args
  local args=("${CURL_ARGS[@]}" -X "$method" -w '\n%{http_code}')
  if [[ -n $body ]]; then
    args+=(-H "Content-Type: application/json" --data-binary "$body")
  fi

  local raw status payload
  raw=$(curl "${args[@]}" "$url") || die "curl failed for $method $url"
  status=${raw##*$'\n'}
  payload=${raw%$'\n'*}

  if [[ $status -ge 400 ]]; then
    local msg
    # v1 puts the text in .message, v2 in .errors[].title/.detail.
    msg=$(printf '%s' "$payload" | jq -r '
      if type == "object" then
        (.message // ([(.errors // [])[] | "\(.title // ""): \(.detail // "")"] | join("; ")))
      else "" end // ""
    ' 2>/dev/null || true)
    [[ -z $msg || $msg == "null" || $msg == ": " ]] && msg=$(printf '%s' "$payload" | head -c 500)
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

# Reads a text argument, or stdin when the argument is exactly "-".
text_arg() {
  if [[ ${1:-} == "-" ]]; then cat; else printf '%s' "${1:-}"; fi
}

urlenc() { jq -rn --arg s "$1" '$s|@uri'; }

# ------------------------------------------------------- page resolution ----

# Pages are addressed either by numeric id or by SPACE:Title, because humans know
# titles and ids only show up in URLs. Everything downstream works on the id.
resolve_page() {
  local ref=${1:?resolve_page needs a page reference}
  if [[ $ref =~ ^[0-9]+$ ]]; then
    printf '%s' "$ref"
    return 0
  fi
  [[ $ref == *:* ]] || die "page reference must be a numeric id or SPACE:Title (got '$ref')"
  local space=${ref%%:*} title=${ref#*:}
  local id
  if [[ $PAGE_API == v2 ]]; then
    local sid; sid=$(space_id "$space")
    id=$(api GET "v2:spaces/$sid/pages?title=$(urlenc "$title")&limit=250" \
      | jq -r --arg t "$title" 'first(.results[] | select(.title == $t) | .id) // empty')
  else
    id=$(api GET "content?spaceKey=$(urlenc "$space")&title=$(urlenc "$title")&limit=1" \
      | jq -r '.results[0].id // empty')
  fi
  [[ -n $id ]] || die "no page titled '$title' in space '$space'"
  printf '%s' "$id"
}

# v2 addresses spaces by numeric id, v1 by key. Translate once, here.
space_id() {
  local key=$1 id
  id=$(api GET "v2:spaces?keys=$(urlenc "$key")&limit=1" | jq -r '.results[0].id // empty')
  [[ -n $id ]] || die "no space with key '$key'"
  printf '%s' "$id"
}

# ------------------------------------------------------------ page bodies ---

# Confluence's native body format is "storage" - XHTML, not markdown. Writing it
# by hand from a shell is miserable, so --text takes plain text and escapes it
# into paragraphs, and --wiki sends legacy wiki markup (h1. / * bullets), which
# both DC and Cloud still accept and convert on the way in.
REPRESENTATION="storage"

text_to_storage() {
  # Escape XML metacharacters, then one <p> per non-empty line.
  jq -rRs '
    gsub("&"; "&amp;") | gsub("<"; "&lt;") | gsub(">"; "&gt;")
    | split("\n")
    | map(if (. | test("^\\s*$")) then empty else "<p>" + . + "</p>" end)
    | join("\n")
  '
}

# ------------------------------------------------------------- commands -----

cmd_whoami() {
  # v2 has no "current user" endpoint; v1's works on both flavors.
  local json; json=$(api GET "user/current")
  emit "$json" '"\(.displayName // .username // .publicName // "?")  <\(.email // .emailAddress // "-")>  \(.accountId // .userKey // .username // "-")"'
}

cmd_spaces() {
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api GET "v2:spaces?limit=250")
    emit "$json" '.results[] | "\(.key)\t\(.name)\t(id \(.id))"'
  else
    json=$(api GET "space?limit=250")
    emit "$json" '.results[] | "\(.key)\t\(.name)\t(id \(.id))"'
  fi
}

cmd_get() {
  local ref=${1:?usage: $PROG get <PAGE-ID|SPACE:Title> [--body]}; shift || true
  local want_body=0
  while [[ $# -gt 0 ]]; do
    case $1 in
      --body) want_body=1; shift ;;
      *) die "unknown option for get: $1" ;;
    esac
  done
  local id; id=$(resolve_page "$ref")
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api GET "v2:pages/$id?body-format=storage&include-labels=true")
    json=$(printf '%s' "$json" | jq '{
      id, title, version: .version.number, spaceId,
      parentId, status,
      labels: [(.labels.results // [])[].name],
      body: (.body.storage.value // "")
    }')
  else
    json=$(api GET "content/$id?expand=body.storage,version,space,ancestors,metadata.labels")
    json=$(printf '%s' "$json" | jq '{
      id, title, version: .version.number, spaceKey: .space.key,
      parentId: (.ancestors // [] | last | .id),
      status,
      labels: [(.metadata.labels.results // [])[].name],
      body: (.body.storage.value // "")
    }')
  fi
  local filter='
    "\(.title)  [id \(.id)  v\(.version)  \(.status // "current")]",
    "  space=\(.spaceKey // .spaceId // "-")  parent=\(.parentId // "-")  labels=\(if (.labels|length)>0 then (.labels|join(",")) else "-" end)"
  '
  [[ $want_body == 1 ]] && filter="$filter, \"\", .body"
  emit "$json" "$filter"
}

cmd_body() {
  local ref=${1:?usage: $PROG body <PAGE-ID|SPACE:Title>}
  local id; id=$(resolve_page "$ref")
  if [[ $PAGE_API == v2 ]]; then
    api GET "v2:pages/$id?body-format=storage" | jq -r '.body.storage.value // ""'
  else
    api GET "content/$id?expand=body.storage" | jq -r '.body.storage.value // ""'
  fi
}

# Current version number - every update has to send exactly current+1.
page_version() {
  local id=$1
  if [[ $PAGE_API == v2 ]]; then
    api GET "v2:pages/$id" | jq -r '.version.number'
  else
    api GET "content/$id?expand=version" | jq -r '.version.number'
  fi
}

cmd_create() {
  local space=${CONFLUENCE_DEFAULT_SPACE:-} title="" body="" parent=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      -s|--space) space=$2; shift 2 ;;
      -t|--title) title=$(text_arg "$2"); shift 2 ;;
      -b|--body) body=$(text_arg "$2"); REPRESENTATION="storage"; shift 2 ;;
      --text) body=$(text_arg "$2" | text_to_storage); REPRESENTATION="storage"; shift 2 ;;
      --wiki) body=$(text_arg "$2"); REPRESENTATION="wiki"; shift 2 ;;
      -p|--parent) parent=$2; shift 2 ;;
      *) die "unknown option for create: $1" ;;
    esac
  done
  [[ -n $space ]] || die "create needs --space (or CONFLUENCE_DEFAULT_SPACE)"
  [[ -n $title ]] || die "create needs --title"

  local json
  if [[ $PAGE_API == v2 ]]; then
    local sid; sid=$(space_id "$space")
    local payload
    payload=$(jq -n --arg s "$sid" --arg t "$title" --arg b "$body" --arg r "$REPRESENTATION" \
      '{spaceId: $s, status: "current", title: $t, body: {representation: $r, value: $b}}')
    [[ -n $parent ]] && payload=$(printf '%s' "$payload" | jq --arg p "$(resolve_page "$parent")" '.parentId = $p')
    json=$(api POST "v2:pages" "$payload")
  else
    local payload
    payload=$(jq -n --arg s "$space" --arg t "$title" --arg b "$body" --arg r "$REPRESENTATION" \
      '{type: "page", title: $t, space: {key: $s}, body: {($r): {value: $b, representation: $r}}}')
    [[ -n $parent ]] && payload=$(printf '%s' "$payload" | jq --arg p "$(resolve_page "$parent")" '.ancestors = [{id: $p}]')
    json=$(api POST "content" "$payload")
  fi
  emit "$json" '"created \(.id)  \(.title)"'
}

# Update is where Confluence bites: the API demands the *next* version number and
# rejects a stale one with 409. We read the current version and increment it, so
# callers never have to think about it - and a 409 still means someone else edited
# the page between our read and our write, which is exactly what it should mean.
cmd_update() {
  local ref=${1:?usage: $PROG update <PAGE-ID|SPACE:Title> [-t title] [-b body|--text|--wiki] [-m message]}; shift
  local title="" body="" have_body=0 message="" version=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      -t|--title) title=$(text_arg "$2"); shift 2 ;;
      -b|--body) body=$(text_arg "$2"); have_body=1; REPRESENTATION="storage"; shift 2 ;;
      --text) body=$(text_arg "$2" | text_to_storage); have_body=1; REPRESENTATION="storage"; shift 2 ;;
      --wiki) body=$(text_arg "$2"); have_body=1; REPRESENTATION="wiki"; shift 2 ;;
      -m|--message) message=$2; shift 2 ;;
      --version) version=$2; shift 2 ;;
      *) die "unknown option for update: $1" ;;
    esac
  done
  [[ -n $title || $have_body == 1 ]] || die "update needs --title and/or a body (-b/--text/--wiki)"

  local id; id=$(resolve_page "$ref")
  local current
  if [[ $PAGE_API == v2 ]]; then
    current=$(api GET "v2:pages/$id?body-format=storage")
  else
    current=$(api GET "content/$id?expand=body.storage,version,space")
  fi
  local cur_ver cur_title cur_body
  cur_ver=$(printf '%s' "$current" | jq -r '.version.number')
  cur_title=$(printf '%s' "$current" | jq -r '.title')
  cur_body=$(printf '%s' "$current" | jq -r '.body.storage.value // ""')
  [[ -n $title ]] || title=$cur_title
  if [[ $have_body == 0 ]]; then body=$cur_body; REPRESENTATION="storage"; fi
  [[ -n $version ]] || version=$(( cur_ver + 1 ))

  local json
  if [[ $PAGE_API == v2 ]]; then
    local payload
    payload=$(jq -n --arg i "$id" --arg t "$title" --arg b "$body" --arg r "$REPRESENTATION" \
      --argjson v "$version" --arg m "$message" \
      '{id: $i, status: "current", title: $t, body: {representation: $r, value: $b},
        version: ({number: $v} + (if $m == "" then {} else {message: $m} end))}')
    json=$(api PUT "v2:pages/$id" "$payload")
  else
    local payload
    payload=$(jq -n --arg i "$id" --arg t "$title" --arg b "$body" --arg r "$REPRESENTATION" \
      --argjson v "$version" --arg m "$message" \
      '{id: $i, type: "page", title: $t, body: {($r): {value: $b, representation: $r}},
        version: ({number: $v} + (if $m == "" then {} else {message: $m} end))}')
    json=$(api PUT "content/$id" "$payload")
  fi
  emit "$json" '"updated \(.id) to v\(.version.number)"'
}

# Appending is the operation agents actually want (add a changelog entry, a result
# table), and doing it by hand means read-modify-write with the version dance.
cmd_append() {
  local ref=${1:?usage: $PROG append <PAGE-ID|SPACE:Title> <text|->}; shift
  local mode="text" text=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      --storage) mode="storage"; shift ;;
      *) text=$(text_arg "$1"); shift ;;
    esac
  done
  [[ -n $text ]] || die "append needs some text"
  local id; id=$(resolve_page "$ref")
  local addition
  if [[ $mode == storage ]]; then addition=$text; else addition=$(printf '%s' "$text" | text_to_storage); fi
  local existing; existing=$(cmd_body "$id")
  printf '%s\n%s' "$existing" "$addition" | cmd_update "$id" -b -
}

cmd_delete() {
  local ref=${1:?usage: $PROG delete <PAGE-ID|SPACE:Title> [--purge]}
  local purge=${2:-}
  local id; id=$(resolve_page "$ref")
  if [[ $PAGE_API == v2 ]]; then
    api DELETE "v2:pages/$id" >/dev/null
    [[ $purge == "--purge" ]] && api DELETE "v2:pages/$id?purge=true" >/dev/null
  else
    api DELETE "content/$id" >/dev/null
    [[ $purge == "--purge" ]] && api DELETE "content/$id?status=trashed" >/dev/null
  fi
  echo "deleted $id${purge:+ (purged)}"
}

cmd_children() {
  local ref=${1:?usage: $PROG children <PAGE-ID|SPACE:Title>}
  local id; id=$(resolve_page "$ref")
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api GET "v2:pages/$id/children?limit=250")
    emit "$json" '.results[] | "\(.id)\t\(.title)"'
  else
    json=$(api GET "content/$id/child/page?limit=250")
    emit "$json" '.results[] | "\(.id)\t\(.title)"'
  fi
}

# CQL search stays on v1 on both flavors: v2 has no CQL endpoint at all, and
# Atlassian has said the v1 search API is not being deprecated.
cmd_search() {
  local cql=${1:?usage: $PROG search <CQL> [-n MAX]}; shift || true
  local max=25
  while [[ $# -gt 0 ]]; do
    case $1 in
      -n|--max) max=$2; shift 2 ;;
      *) die "unknown option for search: $1" ;;
    esac
  done

  # Page until we have `max` results or the server runs out, so callers never
  # silently get truncated at the server's default page size.
  local start=0 collected='[]' total=0 next="" page got
  while :; do
    local want=$(( max - $(printf '%s' "$collected" | jq 'length') ))
    (( want <= 0 )) && break
    (( want > 100 )) && want=100
    if [[ -n $next ]]; then
      page=$(api GET "$next")
    else
      page=$(api GET "search?cql=$(urlenc "$cql")&limit=$want&start=$start")
    fi
    got=$(printf '%s' "$page" | jq '.results | length')
    total=$(printf '%s' "$page" | jq '.totalSize // .size // 0')
    collected=$(jq -n --argjson a "$collected" --argjson b "$(printf '%s' "$page" | jq '.results')" '$a + $b')
    (( got == 0 )) && break
    start=$(( start + got ))
    # Cloud hands back a cursor link; DC just wants the next start offset.
    next=$(printf '%s' "$page" | jq -r '._links.next // empty')
    if [[ -n $next ]]; then
      # Trim a leading /wiki so api() does not double it on Cloud.
      next=${next#/wiki}
      next="/$( printf '%s' "${next#/}" )"
    fi
  done

  # A cursor link carries the server's own page size, so the last hop can overshoot
  # the caller's -n. Trim, so -n stays a hard limit rather than a rounding hint.
  local out
  out=$(jq -n --argjson r "$collected" --argjson t "$total" --argjson m "$max" \
    '{total: $t, results: $r[0:$m]}')
  emit "$out" '
    "\(.total) result(s), showing \(.results | length)",
    (.results[] | "\(.content.id // .id // "-")\t\(.content.title // .title // .name // "-")\t\(.content.space.key // .space.key // .resultGlobalContainer.title // "-")")
  '
}

cmd_comments() {
  local ref=${1:?usage: $PROG comments <PAGE-ID|SPACE:Title>}
  local id; id=$(resolve_page "$ref")
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api GET "v2:pages/$id/footer-comments?body-format=storage&limit=100")
    emit "$json" '.results[] | "[\(.id)] v\(.version.number // 1)\n\(.body.storage.value // "")\n"'
  else
    json=$(api GET "content/$id/child/comment?expand=body.storage,version,history&limit=100")
    emit "$json" '.results[] | "[\(.id)] \(.history.createdBy.displayName // "?")  \(.history.createdDate // "")\n\(.body.storage.value // "")\n"'
  fi
}

cmd_comment() {
  local ref=${1:?usage: $PROG comment <PAGE-ID|SPACE:Title> <text|->}; shift
  local text; text=$(text_arg "${1:-}")
  [[ -n $text ]] || die "comment body is empty"
  local id; id=$(resolve_page "$ref")
  local storage; storage=$(printf '%s' "$text" | text_to_storage)
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api POST "v2:footer-comments" \
      "$(jq -n --arg p "$id" --arg b "$storage" \
        '{pageId: $p, body: {representation: "storage", value: $b}}')")
  else
    json=$(api POST "content" \
      "$(jq -n --arg p "$id" --arg b "$storage" \
        '{type: "comment", container: {id: $p, type: "page"},
          body: {storage: {value: $b, representation: "storage"}}}')")
  fi
  emit "$json" '"commented on '"$id"' (comment \(.id))"'
}

# Labels are Confluence's tags. v2 can read them but not write them, so writes go
# through v1 on both flavors - one of the parity gaps that keeps v1 alive.
cmd_labels() {
  local ref=${1:?usage: $PROG labels <PAGE-ID|SPACE:Title>}
  local id; id=$(resolve_page "$ref")
  local json; json=$(api GET "content/$id/label")
  emit "$json" '.results[] | "\(.name)\t(prefix \(.prefix // "global"))"'
}

cmd_label() {
  local action=${1:?usage: $PROG label <add|rm|set> <PAGE> <label...>}
  local ref=${2:?usage: $PROG label <add|rm|set> <PAGE> <label...>}
  shift 2
  [[ $# -gt 0 ]] || die "label needs at least one label"
  local id; id=$(resolve_page "$ref")
  local l
  case $action in
    add)
      local body='[]'
      for l in "$@"; do
        body=$(printf '%s' "$body" | jq --arg n "$l" '. + [{prefix: "global", name: $n}]')
      done
      api POST "content/$id/label" "$body" >/dev/null
      ;;
    rm|remove)
      for l in "$@"; do
        api DELETE "content/$id/label/$(urlenc "$l")" >/dev/null
      done
      ;;
    set)
      local existing
      existing=$(api GET "content/$id/label" | jq -r '.results[].name')
      while IFS= read -r l; do
        [[ -n $l ]] && api DELETE "content/$id/label/$(urlenc "$l")" >/dev/null
      done <<< "$existing"
      local body='[]'
      for l in "$@"; do
        body=$(printf '%s' "$body" | jq --arg n "$l" '. + [{prefix: "global", name: $n}]')
      done
      api POST "content/$id/label" "$body" >/dev/null
      ;;
    *) die "label action must be add, rm or set (got '$action')" ;;
  esac
  echo "labels $action on $id: $*"
}

# Attachment upload is multipart, so it bypasses api() - and it is v1-only on both
# flavors, because v2 has no upload endpoint.
cmd_attach() {
  local ref=${1:?usage: $PROG attach <PAGE> <file>}
  local file=${2:?usage: $PROG attach <PAGE> <file>}
  [[ -f $file ]] || die "no such file: $file"
  local id; id=$(resolve_page "$ref")

  curl_auth_args
  local args=("${CURL_ARGS[@]}" -X POST -H "X-Atlassian-Token: nocheck" -w '\n%{http_code}')
  local raw status payload
  raw=$(curl "${args[@]}" -F "file=@$file" "$API1/content/$id/child/attachment")
  status=${raw##*$'\n'}; payload=${raw%$'\n'*}
  [[ $status -ge 400 ]] && die "HTTP $status attaching $file: $(printf '%s' "$payload" | head -c 300)"
  emit "$payload" '.results[]? // .[]? | "attached \(.title // .filename) (id \(.id))"'
}

cmd_attachments() {
  local ref=${1:?usage: $PROG attachments <PAGE>}
  local id; id=$(resolve_page "$ref")
  local json; json=$(api GET "content/$id/child/attachment?limit=100")
  emit "$json" '.results[] | "\(.id)\t\(.title)\t\(.extensions.fileSize // "?") bytes"'
}

cmd_versions() {
  local ref=${1:?usage: $PROG versions <PAGE>}
  local id; id=$(resolve_page "$ref")
  local json
  if [[ $PAGE_API == v2 ]]; then
    json=$(api GET "v2:pages/$id/versions?limit=50")
    emit "$json" '.results[] | "v\(.number)\t\(.createdAt // "")\t\(.message // "")"'
  else
    json=$(api GET "content/$id/version?limit=50")
    emit "$json" '.results[] | "v\(.number)\t\(.when // "")\t\(.message // "")\t\(.by.displayName // "")"'
  fi
}

cmd_move() {
  local ref=${1:?usage: $PROG move <PAGE> --parent <PAGE>}; shift
  local parent=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      -p|--parent) parent=$2; shift 2 ;;
      *) die "unknown option for move: $1" ;;
    esac
  done
  [[ -n $parent ]] || die "move needs --parent"
  local id pid; id=$(resolve_page "$ref"); pid=$(resolve_page "$parent")
  local ver title; ver=$(page_version "$id")
  if [[ $PAGE_API == v2 ]]; then
    title=$(api GET "v2:pages/$id" | jq -r '.title')
    local body; body=$(cmd_body "$id")
    api PUT "v2:pages/$id" "$(jq -n --arg i "$id" --arg t "$title" --arg p "$pid" --arg b "$body" \
      --argjson v "$(( ver + 1 ))" \
      '{id: $i, status: "current", title: $t, parentId: $p,
        body: {representation: "storage", value: $b}, version: {number: $v}}')" >/dev/null
  else
    title=$(api GET "content/$id" | jq -r '.title')
    api PUT "content/$id" "$(jq -n --arg i "$id" --arg t "$title" --arg p "$pid" \
      --argjson v "$(( ver + 1 ))" \
      '{id: $i, type: "page", title: $t, ancestors: [{id: $p}], version: {number: $v}}')" >/dev/null
  fi
  echo "moved $id under $pid"
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
  if [[ -n ${CONFLUENCE_PAT:-} ]]; then
    auth="PAT (Bearer, DC/Server)"
  elif [[ -n ${CONFLUENCE_USER:-} ]]; then
    auth="Basic as ${CONFLUENCE_USER} (Cloud)"
  fi
  cat <<EOF
Credentials are read from the first file found, in this order:
  1. \$CONFLUENCE_ENV_FILE      (currently: ${CONFLUENCE_ENV_FILE:-unset})
  2. ./.confluence.env         (project-local override)
  3. ~/.claude/confluence.env  <-- recommended: one PAT, reusable across all projects
  4. ~/.confluence.env

Currently loaded: ${CONFLUENCE_ENV_FILE_USED:-<none>}
CONFLUENCE_URL=${CONFLUENCE_URL:-<unset>}
Auth: $auth
Flavor: ${CONFLUENCE_FLAVOR:-<unset>}   page API: ${PAGE_API:-<unset>}
v1 base: ${API1:-<unset>}
v2 base: ${API2:-<unset>} $([[ ${CONFLUENCE_FLAVOR:-} == server ]] && echo "(unused - DC has no v2)")

Create it with:
  install -m 600 /dev/null ~/.claude/confluence.env
  \$EDITOR ~/.claude/confluence.env

See confluence.env.example next to this script for the full list of variables.
EOF
}

usage() {
  cat <<EOF
$PROG - Confluence from the shell (DC/Server via PAT, or Cloud via API token).

Pages are addressed by numeric id or by SPACE:Title, e.g. 'get DOCS:Release Notes'.

Read:
  whoami                              who the token belongs to
  spaces                              all spaces (key, name, id)
  get <PAGE> [--body]                 title, version, space, parent, labels
  body <PAGE>                         just the storage-format body
  children <PAGE>                     direct child pages
  search <CQL> [-n MAX]               CQL search, auto-paginated
  comments <PAGE>                     footer comments
  labels <PAGE>                       labels (tags) on a page
  attachments <PAGE>                  attachment list
  versions <PAGE>                     version history

Write:
  create -s SPACE -t "Title" [--text "..."|-b <storage>|--wiki "..."] [-p PARENT]
  update <PAGE> [-t "Title"] [--text "..."|-b <storage>|--wiki "..."] [-m "why"]
  append <PAGE> <text|-> [--storage]  read-modify-write, version handled for you
  comment <PAGE> <text|->             '-' reads the body from stdin
  label <add|rm|set> <PAGE> <label...>
  attach <PAGE> <file>
  move <PAGE> --parent <PAGE>
  delete <PAGE> [--purge]             trashes; --purge also empties it from trash

Escape hatch:
  raw <METHOD> <path> [json]          'content/123' (v1) or 'v2:pages/123' (v2)

Global:
  --json      print the raw JSON response instead of the text summary
  config      show where credentials are read from, and which API is in play
  -h|--help

Body formats: Confluence stores XHTML ("storage"), not markdown.
  --text  plain text, escaped into <p> paragraphs for you  <- use this by default
  --wiki  legacy wiki markup (h1. Heading, * bullet), converted server-side
  -b      raw storage XHTML, passed through untouched
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
  spaces) cmd_spaces "$@" ;;
  get) cmd_get "$@" ;;
  body) cmd_body "$@" ;;
  children) cmd_children "$@" ;;
  search) cmd_search "$@" ;;
  comments) cmd_comments "$@" ;;
  comment) cmd_comment "$@" ;;
  labels) cmd_labels "$@" ;;
  label) cmd_label "$@" ;;
  attach) cmd_attach "$@" ;;
  attachments) cmd_attachments "$@" ;;
  versions) cmd_versions "$@" ;;
  create) cmd_create "$@" ;;
  update) cmd_update "$@" ;;
  append) cmd_append "$@" ;;
  move) cmd_move "$@" ;;
  delete) cmd_delete "$@" ;;
  raw) cmd_raw "$@" ;;
  *) die "unknown command '$cmd'. Run '$PROG --help'." ;;
esac
