# Evals

## db-cli skill — [db-cli-skill.html](db-cli-skill.html)

Does the `db-cli` skill (`.claude/skills/db-cli`) get picked up by a headless agent, and what does
it save over an agent left to find its own way into the local Postgres?

**Result (42 runs, Sonnet 5.5, 18 Nov 2026):** with the skill the agent went through `db-cli.py` in
all 21 runs (it loaded the skill explicitly in 19), and answered 19–61% faster for 36–77% less money. But on `lookup` it got the
date wrong in all 7 runs: `db-cli.py` prints the visit timestamp in UTC (`2024-03-03 23:00Z`), and
the agent reports that UTC date, while `psql` shows it in the database's timezone (`2024-03-04`).
Without the skill `live-state` failed 3/7 times: the agent never reached the database.

Open the HTML in a browser (`open docs/eval/db-cli-skill.html`): tasks, a Gauss curve per arm for
time, cost and context tokens, correctness, the route each run took, and every final answer.

### How it was run

On 18 Nov 2026, 10:50–10:53, from `main` at `8aa6f8d3`, with Claude Code 2.1.327:

```sh
S=<a scratch dir>
evals/db-cli/run.py --out $S/full          # defaults: --runs 7 --model sonnet --parallel 6
evals/db-cli/report.py $S/full --html $S/full/report.html
```

- `run.py` makes two throwaway arms from `git archive HEAD`: **with** keeps the skill, **without**
  deletes `.claude/skills/db-cli` and its hint in `.mcp.json`. Both drop `evals/` (it holds the
  expected answers) and become fresh one-commit repos, so the agent can't `git show` the skill back.
- Each of the 3 tasks × 2 arms × 7 runs is a fresh `claude -p "<prompt>"` in its arm:
  `--setting-sources project`, `--strict-mcp-config` with no MCP server, `bypassPermissions`,
  `--no-session-persistence`, `--max-budget-usd 3`, `CLAUDE*` env vars stripped. The shell is the
  only way into the database. Runs are interleaved across arms, 6 at a time; each writes a
  stream-json log.
- `report.py` grades each final answer against the regexes in `evals/db-cli/tasks.json` (every
  expected fact present, the trap absent), reads time, tokens and cost from the result event, and
  classifies the route to the data from the Bash commands.

This page was rendered afterwards from the same logs:

```sh
evals/db-cli/pretty_report.py $S/full --commit 8aa6f8d3   # writes db-cli-skill.html + db-cli-runs.json
evals/db-cli/pretty_report.py docs/eval/db-cli-runs.json  # rebuilds the page without the raw logs
```

`db-cli-runs.json` holds the parsed metrics and final answer of every run; the 31 MB of raw logs
were not kept.
