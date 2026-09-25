---
name: db-cli
description: Query the petclinic Postgres database (owners, pets, vets, visits, types, specialties) by calling the project's Postgres MCP server as a shell command. Use whenever a task needs to read or inspect petclinic data or schema AND no database MCP tools are available (no mcp__postgres-db__* tools). Also use when explicitly asked to "use the db-cli skill".
allowed-tools: Bash(.claude/skills/db-cli/db-cli.py:*), Bash(jq:*)
---

# Database access when MCP servers are disabled

The `postgres-db` MCP server declared in `.mcp.json` is not connected in this
session. The **same server** is still reachable from the shell: `db-cli.py` starts
it and speaks MCP to it over stdio (stdlib-only Python, needs just `python3` and
`npx`). Same tools, same parameters, same JSON responses — only the transport
differs, and nothing about the server changes once MCP access is restored.

Run everything below from the repo root.

## 1. Discover what the server offers

```bash
.claude/skills/db-cli/db-cli.py tools
```

Prints every tool with its parameter signature and description — the same
information an MCP client would put in your tool list. Run this first if you
are unsure what is available.

## 2. Call a tool

```bash
.claude/skills/db-cli/db-cli.py call <tool_name> --params '<json>'
```

The two tools this server exposes:

```bash
# run SQL
.claude/skills/db-cli/db-cli.py call execute_sql \
  --params '{"sql":"select count(*) from owners"}'

# explore the schema without guessing table names
.claude/skills/db-cli/db-cli.py call search_objects \
  --params '{"object_type":"table"}'
```

## 3. Keep the output small

The JSON envelope is verbose. Take only the rows:

```bash
.claude/skills/db-cli/db-cli.py call execute_sql \
  --params '{"sql":"select name from types"}' | jq -c '.data.statements[0].rows'
```

## When it fails

The script prints dbhub's own stderr, so read that first. Two causes have bitten
before, and the script already handles both:

- `npx` lives under `nvm`, which is **not on a non-interactive agent shell's
  PATH** (that shell never sources `~/.zshrc`). The script looks in
  `~/.nvm/versions/node/*/bin` itself.
- On a machine that has never run this dbhub version, `npx` **downloads** it on
  first use. The script waits up to 120s (`DB_CLI_TIMEOUT`) for the first answer.

`ECONNREFUSED` in the output means Postgres is not running: `./start-database.sh`.

## Schema cheat-sheet

`owners`, `pets` (`type_id` → `types`, `owner_id` → `owners`), `visits`
(`pet_id`), `vets`, `specialties`, `vet_specialties`, `users`, `roles`.
Full model: see the ER model section in `AGENTS.md`.

## Rules

- **Read-only.** No INSERT / UPDATE / DELETE / DDL unless explicitly asked.
- Prefer one aggregated SQL query over several small ones — each call pays a
  ~2s server startup.
- An empty database is usually not a bug: Flyway seeds it when the **backend**
  boots (see `AGENTS.md` → Database).

## Why not a direct Postgres client

There is deliberately only **one** way into the database: the `dbhub` MCP
server. It is reachable two ways — as an MCP tool where the harness supports
MCP, and through this CLI bridge where it does not. Both hit the same server,
so its guardrails and behaviour are identical either way.
