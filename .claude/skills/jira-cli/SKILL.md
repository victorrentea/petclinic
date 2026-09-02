---
name: jira-cli
description: Read and write JIRA issues from the shell — get/search issues, create, update, comment, label (tag), assign, transition, link, attach, log work — against a local or corporate JIRA Server/Data Center using a Personal Access Token (or JIRA Cloud with an API token). Use whenever a task needs JIRA AND no JIRA MCP tools are available (no mcp__atlassian__*, no mcp__jira__*), which is the normal situation when corporate policy disables MCP servers. Also use when explicitly asked to "use the jira-cli skill".
allowed-tools: Bash(.claude/skills/jira-cli/jira.sh:*), Bash(jq:*)
---

# JIRA from the shell, when MCP servers are disabled

`jira.sh` is a self-contained `curl` + `jq` client for the JIRA REST API. It covers
the same read/write surface as the [mcp-atlassian](https://github.com/sooperset/mcp-atlassian)
MCP server's Jira half, minus the MCP transport — which is exactly the part corporate
policy tends to block.

No install, no runtime, no `pip`/`npm`: **bash, curl and jq** are all it needs.

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

The default text output exists because it is far cheaper in tokens than the raw
JSON, which for one issue is routinely 20 KB of fields you did not ask for.

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

## 5. Tests

```sh
.claude/skills/jira-cli/test/run-tests.sh          # hermetic, ~5s, no network
.claude/skills/jira-cli/test/run-tests.sh --live   # against a real JIRA
.claude/skills/jira-cli/test/run-tests.sh --all
```

`test/scenario.sh` holds the full lifecycle — create, read, update, comment, label,
assign, transition, worklog, attach, link, paginate, delete — and is written **once**
and run against both backends, so whatever the fake proves, the live run re-proves
for real.

- **Hermetic** (`e2e-fake.sh`): boots `fake_jira.py`, a stdlib stand-in for the JIRA
  REST v2 API, on a random port and drives `jira.sh` over real HTTP — real curl, real
  status codes, real 401s. It caps a search page at 2 results on purpose, so a client
  that forgot to paginate fails the suite. 48 assertions.
- **Live** (`e2e-live.sh`): same scenario against a real instance. It creates ~5
  throwaway issues and deletes them again, so point it at a **sandbox project**.

### Getting a real JIRA to point the live suite at

**Self-hosted JIRA is no longer obtainable for free.** Atlassian's image is free to
pull, but the product needs a licence, and [since 30 March 2026 you can no longer
generate Data Center trial licences yourself](https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/1189482127/Get+a+Jira+Data+Center+trial+license)
— the self-serve form now only offers Cloud and third-party Marketplace apps. A DC
trial has to come from Atlassian's purchasing team. Jira Server has been end-of-life
since 2024. So, in practice:

| You want | Use | Auth exercised |
|---|---|---|
| Fast, always-runnable coverage | the hermetic fake (default) | **PAT / Bearer** |
| Real JIRA semantics, zero cost | [Jira Cloud Free](https://www.atlassian.com/software/jira/free) (10 users) | Basic |
| The real thing | your corporate JIRA, sandbox project | **PAT / Bearer** |

The fake is what covers the PAT/Bearer path day to day, so a Cloud-only live run is
not a gap in coverage — the two backends complement each other.

For Cloud, put this in `~/.claude/jira-test.env` and run the live suite as usual:

```sh
JIRA_URL=https://<you>.atlassian.net
JIRA_USER=you@example.com
JIRA_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>
```

`test/docker/` still holds a working JIRA + Postgres compose file on port 8082 (not
8080, so it cannot collide with the PetClinic backend) — useful **only if you already
have a Data Center licence key**. It needs ~4 GB of free Docker disk. Start with
`start-jira.sh`, tear down with `start-jira.sh down`, or `destroy` to drop the volumes.
