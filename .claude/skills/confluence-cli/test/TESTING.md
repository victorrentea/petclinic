# Testing confluence-cli

(No file points here on purpose — SKILL.md stays lean for the agents that only
*use* the skill. This is for whoever *works on* it.)

## Running

```sh
.claude/skills/confluence-cli/test/run-tests.sh          # hermetic, ~5s, no network
.claude/skills/confluence-cli/test/run-tests.sh --live   # against a real Confluence
.claude/skills/confluence-cli/test/run-tests.sh --all
```

`scenario.sh` holds the full lifecycle — create, read, update, the version
conflict, append, all three body formats, labels, comments, attachments, hierarchy,
move, search pagination, delete — and is written **once** and run against every backend.

- **Hermetic** (`e2e-fake.sh`): boots `fake_confluence.py`, a stdlib stand-in that
  serves **both v1 and v2**, on a random port and drives `confluence.sh` over real HTTP —
  real curl, real status codes, real 401s, real 409s. The scenario then runs **twice**,
  once as Data Center (PAT + v1) and once as Cloud (Basic + `/wiki` + v2), because a
  green v1 run says nothing about v2. It caps a search page at 2 on purpose, so a client
  that forgot to paginate fails the suite. 105 assertions.
- **Live** (`e2e-live.sh`): the same scenario against a real instance. It creates ~9
  throwaway pages and deletes them again, so point it at a **sandbox space**.

### Getting a real Confluence to point the live suite at

**Yes — and it is free.** [Confluence Cloud Free](https://www.atlassian.com/software/confluence/pricing)
is free indefinitely for up to 10 users, which is a real, fully-functional Confluence
that the live suite can drive.

The useful part: **a free Atlassian Cloud site can run both Jira and Confluence, and
one API token authenticates both.** So a single `<you>.atlassian.net` site is the live
backend for *this* suite and for [jira-cli](../../jira-cli/SKILL.md)'s at the same time.

```sh
install -m 600 /dev/null ~/.claude/confluence-test.env
cat > ~/.claude/confluence-test.env <<'EOF'
CONFLUENCE_URL=https://<you>.atlassian.net
CONFLUENCE_USER=you@example.com
CONFLUENCE_API_TOKEN=<id.atlassian.com/manage-profile/security/api-tokens>
EOF

export CONFLUENCE_TEST_SPACE=SAND      # create a throwaway space first
.claude/skills/confluence-cli/test/run-tests.sh --live
```

**Self-hosted Confluence is not obtainable for free**, exactly as for Jira: the Docker
image pulls fine but the product needs a licence, and Atlassian
[stopped issuing self-serve Data Center trial licences on 30 March 2026](https://confluence.atlassian.com/spaces/ADMINJIRASERVER/pages/1189482127/Get+a+Jira+Data+Center+trial+license).
Confluence Server has been end-of-life since 2024.

| You want | Use | Auth + API exercised |
|---|---|---|
| Fast, always-runnable coverage of **both** API paths | the hermetic fake (default) | **PAT + v1** *and* **Basic + v2** |
| Real Confluence semantics, zero cost | [Confluence Cloud Free](https://www.atlassian.com/software/confluence/pricing) (10 users) | Basic + v2 |
| The real DC thing | your corporate Confluence, sandbox space | **PAT + v1** |

The gap worth knowing: a Cloud-only live run never exercises the **PAT + v1** path, and
a corporate DC run never exercises **v2**. That is precisely why the fake runs both —
it is the only backend that covers the combination, and it is the one that runs on
every change.
