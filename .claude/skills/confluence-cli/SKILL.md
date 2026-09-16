---
name: confluence-cli
description: Read and write Confluence pages from the shell — get/search pages, create, update, append, comment, label (tag), attach, move, delete — against a corporate Confluence Data Center/Server using a Personal Access Token (or Confluence Cloud with an API token). Use whenever a task needs Confluence AND no Confluence MCP tools are available (no mcp__atlassian__*, no mcp__confluence__*), which is the normal situation when corporate policy disables MCP servers. Also use when explicitly asked to "use the confluence-cli skill".
allowed-tools: Bash(.claude/skills/confluence-cli/confluence.sh:*), Bash(jq:*)
---

# Confluence from the shell, when MCP servers are disabled

`confluence.sh` is a self-contained `curl` + `jq` client for the Confluence REST API —
the sibling of [jira-cli](../jira-cli/SKILL.md), same env-file mechanism, same `--json`
convention, same escape hatch. Needs only bash, curl and jq.

## 1. One-time setup

The token lives in `~/.claude/confluence.env` — outside every repo, so the same PAT is
reusable across all your projects and cannot be committed by accident:

```sh
install -m 600 /dev/null ~/.claude/confluence.env
cat > ~/.claude/confluence.env <<'EOF'
CONFLUENCE_URL=https://confluence.your-company.com
CONFLUENCE_PAT=<Settings -> Personal Access Tokens -> Create token>
EOF
```

`confluence.env.example` next to this file documents every variable (Cloud auth,
self-signed certs, default space). Lookup order — first file wins:

```
$CONFLUENCE_ENV_FILE -> ./.confluence.env -> ~/.claude/confluence.env -> ~/.confluence.env
```

Verify:

```sh
.claude/skills/confluence-cli/confluence.sh config    # where creds came from, and which API is in play
.claude/skills/confluence-cli/confluence.sh whoami
```

## 2. Which REST API you are talking to

This is the one thing worth understanding before using the skill, because Confluence
is mid-migration and the two products diverge:

| | Data Center / Server | Cloud |
|---|---|---|
| Page CRUD | v1 `/rest/api/content` — the only API there is | v2 `/wiki/api/v2/pages` (default) |
| CQL search | v1 `/rest/api/search` | v1 — **v2 has no CQL endpoint at all** |
| Label writes | v1 `/rest/api/content/{id}/label` | v1 — v2 can read labels but not write them |
| Attachment upload | v1 `/rest/api/content/{id}/child/attachment` | v1 — v2 has no upload endpoint |
| Auth | PAT, `Authorization: Bearer` | API token, HTTP Basic |

So Cloud is inherently a **v1/v2 hybrid**, and that is not a shortcut in this script —
it is the state of the API. `confluence.sh` picks the right one per command and
`confluence.sh config` prints which. Override with `CONFLUENCE_PAGE_API=v1` if you hit
a v2 gap; asking for v2 against Data Center fails fast rather than 404-ing mysteriously.

Atlassian has been withdrawing Cloud v1 endpoints group by group (the timeline has
slipped repeatedly since 2024), which is why page CRUD defaults to v2 there. The v1
*search* API is explicitly **not** on the deprecation list.

## 3. Reading

Pages are addressed either by numeric id or by `SPACE:Title`, because humans know
titles and ids only ever show up in URLs.

```sh
C=.claude/skills/confluence-cli/confluence.sh

$C spaces
$C get "DOCS:Release Notes"           # title, version, space, parent, labels
$C get 123456 --body                  # ... plus the storage XHTML
$C body "DOCS:Release Notes"          # just the body, for piping
$C children "DOCS:Release Notes"
$C search 'space = DOCS and label = "runbook"'
$C search 'text ~ "flyway"' -n 100    # auto-paginates; -n is a hard limit
$C comments 123456
$C labels 123456
$C versions 123456
```

Add `--json` to any command to get the raw API response instead of the text summary:

```sh
$C --json get 123456 | jq -r '.labels[]'
```

The default text output exists because it is far cheaper in tokens than the raw JSON,
which for one page is routinely tens of KB of `_links` and `_expandable` you did not ask for.

## 4. Writing

**Confluence stores XHTML ("storage format"), not markdown.** Three ways in:

```sh
$C create -s DOCS -t "Runbook: DB restore" --text "Steps are below."   # plain text, escaped into <p> for you
$C create -s DOCS -t "Notes" --wiki "h1. Heading
* bullet"                                                             # legacy wiki markup, converted server-side
$C create -s DOCS -t "Exact" -b '<p>raw <strong>storage</strong></p>' # passed through untouched
```

Use `--text` by default. Markdown is **not** a Confluence input format; passing it
gets you a page with literal `##` in it.

```sh
$C update 123456 -t "New title"                  # version handled for you
$C update 123456 --text "replacement body" -m "why I changed it"
$C append 123456 "One more line"                 # read-modify-write, keeps the old body
git log -1 --format=%B | $C append 123456 -
$C comment 123456 "Deployed in d7c8f8c"
$C label add 123456 runbook needs-review         # tag
$C label rm  123456 needs-review
$C label set 123456 only these                   # replaces the whole list
$C attach 123456 ./heap-dump.txt
$C move 123456 --parent "DOCS:Runbooks"
$C delete 123456                                 # trashes it
$C delete 123456 --purge                         # ... and empties it from the trash
```

**The version dance** is Confluence's sharpest edge: every update must send exactly
`current + 1`, and a stale number is a 409. `update` and `append` read the current
version and increment it for you, so a 409 from this script means what it should —
somebody else edited the page between your read and your write. Retry, don't force.

Anything not wrapped is reachable through the escape hatch, which still handles auth,
errors and JSON formatting:

```sh
$C raw GET  "content/123456/history"       # v1: relative to /rest/api
$C raw GET  "v2:pages/123456/versions"     # v2: 'v2:' prefix
$C raw POST "/rest/api/content" '{"type":"page", ...}'
```

## 5. Rules for agents

- **Never print or echo the PAT**, and never copy it into a repo file. Read it only
  through the env-file mechanism. `confluence.sh config` is safe; `cat ~/.claude/confluence.env` is not.
- **Confirm before writing.** A Confluence page is usually team-visible documentation,
  and `update` *replaces* the body — `append` is almost always the safer verb when
  adding to an existing page. Ask first unless the user's request already names the action.
- **Read before you update.** `update --text` overwrites the whole body. If you mean
  "add a section", use `append`.
- Prefer `--json | jq` when you need one field; prefer the default text output when you
  need to *read* a page. Do not dump whole storage-format bodies into the transcript.
- Errors always carry the HTTP status: `confluence.sh: HTTP 403 on PUT .../content/123 - ...`.
  A 401 means the token is wrong or expired, 403 means the token lacks the permission,
  404 on a page that exists usually also means a permissions problem, and **409 means a
  version conflict** — re-read and retry.
- CQL goes in single quotes when it contains double quotes: `$C search 'label = "runbook"'`.
