# Testing jira-cli

(No file points here on purpose — SKILL.md stays lean for the agents that only
*use* the skill. This is for whoever *works on* it.)

## Running

```sh
.claude/skills/jira-cli/test/run-tests.sh          # hermetic, ~5s, no network
.claude/skills/jira-cli/test/run-tests.sh --live   # against a real JIRA
.claude/skills/jira-cli/test/run-tests.sh --all
```

`scenario.sh` holds the full lifecycle — create, read, update, comment, label,
assign, transition, worklog, attach, link, paginate, delete — and is written **once**
and run against both backends, so whatever the fake proves, the live run re-proves
for real.

- **Hermetic** (`e2e-fake.sh`): boots `fake_jira.py`, a stdlib stand-in for the JIRA
  REST v2 API, on a random port and drives `jira.sh` over real HTTP — real curl, real
  status codes, real 401s. It caps a search page at 2 results on purpose, so a client
  that forgot to paginate fails the suite. 48 assertions.
- **Live** (`e2e-live.sh`): same scenario against a real instance. It creates ~5
  throwaway issues and deletes them again, so point it at a **sandbox project**.

## Getting a real JIRA to point the live suite at

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

`docker/` still holds a working JIRA + Postgres compose file on port 8082 (not
8080, so it cannot collide with the PetClinic backend) — useful **only if you already
have a Data Center licence key**. It needs ~4 GB of free Docker disk. Start with
`start-jira.sh`, tear down with `start-jira.sh down`, or `destroy` to drop the volumes.
