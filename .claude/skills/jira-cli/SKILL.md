---
name: jira-cli
description: Read and write JIRA issues from the shell — get/search issues, create, update, comment, label (tag), assign, transition, link, attach, log work — against a local or corporate JIRA Server/Data Center using a Personal Access Token (or JIRA Cloud with an API token). Use whenever a task needs JIRA AND no JIRA MCP tools are available (no mcp__atlassian__*, no mcp__jira__*), which is the normal situation when corporate policy disables MCP servers. Also use when explicitly asked to "use the jira-cli skill".
allowed-tools: Bash(.claude/skills/jira-cli/jira.sh:*), Bash(jq:*)
---

# JIRA from the shell, when MCP servers are disabled

`jira.sh` is a self-contained `curl` + `jq` client for the JIRA REST API — same
read/write surface as an Atlassian MCP server, no MCP transport. Needs only bash,
curl and jq.

## 1. One-time setup

The token lives in `~/.claude/jira.env` — outside every repo, so the same PAT is
reusable across all your projects and cannot be committed by accident:

```sh
install -m 600 /dev/null ~/.claude/jira.env
cat > ~/.claude/jira.env <<'EOF'
JIRA_URL=https://jira.your-company.com
JIRA_PAT=<Profile -> Personal Access Tokens -> Create token>
EOF
```

`jira.env.example` next to this file documents every variable (Cloud auth, self-signed
certs, default project). Lookup order — first file wins:

```
$JIRA_ENV_FILE  ->  ./.jira.env  ->  ~/.claude/jira.env  ->  ~/.jira.env
```

so a single project can override the shared token with a local `./.jira.env`.

Verify:

```sh
.claude/skills/jira-cli/jira.sh config     # where creds came from (never prints the token)
.claude/skills/jira-cli/jira.sh whoami
```

## 2. Reading

```sh
J=.claude/skills/jira-cli/jira.sh

$J get PET-42                              # summary, status, assignee, labels, description
$J get PET-42 --fields summary,status      # narrow the payload
$J search "project = PET AND status != Done ORDER BY created DESC"
$J search "assignee = currentUser()" -n 200   # auto-paginates; -n is a hard limit
$J comments PET-42
$J transitions PET-42                      # what this issue can move to right now
$J projects | $J issuetypes PET | $J fields "story points"
```

Add `--json` to any command to get the raw API response instead of the text
summary — use it when you need to pipe into `jq`:

```sh
$J --json get PET-42 | jq -r '.fields.labels[]'
```

## 3. Writing

```sh
$J create -p PET -t Bug -s "Owner search returns duplicates" \
          -d "Repro: search 'Fra' with two pets" -l regression -l search -a victor
$J update PET-42 -s "new summary" -d "new description"
$J comment PET-42 "Fixed in d7c8f8c, please retest"
git log -1 --format=%B | $J comment PET-42 -      # '-' reads the body from stdin
$J label add PET-42 needs-review regression       # tag
$J label rm  PET-42 regression
$J label set PET-42 only these                    # replaces the whole list
$J assign PET-42 victor      # '-' unassigns
$J transition PET-42 "In Progress"   # by transition name OR target status name
$J link PET-42 Blocks PET-43         # $J linktypes for the vocabulary
$J attach PET-42 ./heap-dump.txt
$J worklog PET-42 2h "pairing on the repository layer"
$J watch PET-42
$J delete PET-42
```

Custom fields take `-f/--field`, either as text or as raw JSON:

```sh
$J update PET-42 -f customfield_10010=8                  # string
$J update PET-42 -f 'components:=[{"name":"api"}]'       # ':=' means raw JSON
$J fields "story points"                                 # find the customfield_ id
```

Anything not wrapped is reachable through the escape hatch, which still handles
auth, errors and JSON formatting for you:

```sh
$J raw GET  "issue/PET-42/changelog"
$J raw POST "/rest/agile/1.0/sprint/12/issue" '{"issues":["PET-42"]}'
```

## 4. Rules for agents

- **Never print or echo the PAT**, and never copy it into a repo file. Read it only
  through the env-file mechanism. `jira.sh config` is safe; `cat ~/.claude/jira.env` is not.
- **Confirm before writing.** `create`, `update`, `comment`, `transition`, `delete`
  are visible to the whole team and mostly irreversible — `delete` entirely so. Ask
  first unless the user's request already names the action.
- Prefer `--json | jq` when you need one field; prefer the default text output when
  you need to *read* an issue. Do not dump whole `--json` payloads into the transcript.
- Errors always carry the HTTP status: `jira.sh: HTTP 403 on PUT .../issue/PET-42 - ...`.
  A 401 means the PAT is wrong or expired, a 403 means the token lacks the permission,
  a 404 on a key that exists usually also means a permissions problem.
- JQL goes in single quotes when it contains double quotes: `$J search 'summary ~ "beta"'`.
