---
name: petclinic-db-cli
description: Query the petclinic Postgres database (owners, pets, vets, visits, types, specialties) by calling the project's Postgres MCP server as a shell command. Use whenever a task needs to read or inspect petclinic data or schema AND no database MCP tools are available (no mcp__postgres-db__* tools). Also use when explicitly asked to "use the petclinic-db-cli skill".
allowed-tools: Bash(.claude/skills/petclinic-db-cli/db-cli.sh:*), Bash(mcptools:*), Bash(jq:*)
---

# Database access when MCP servers are disabled

The `postgres-db` MCP server declared in `.mcp.json` is not connected in this
session. The **same server** is still reachable from the shell through
[`mcptools`](https://github.com/f/mcptools), an MCP-to-CLI bridge. Same tools,
same parameters, same JSON responses — only the transport differs, and nothing
about the server changes once MCP access is restored.

Run everything below from the repo root.

## 1. Discover what the server offers

```bash
.claude/skills/petclinic-db-cli/db-cli.sh tools
```

Prints every tool with its parameter signature and description — the same
information an MCP client would put in your tool list. Run this first if you
are unsure what is available.

## 2. Call a tool

```bash
.claude/skills/petclinic-db-cli/db-cli.sh call <tool_name> --params '<json>'
```

The two tools this server exposes:

```bash
# run SQL
.claude/skills/petclinic-db-cli/db-cli.sh call execute_sql \
  --params '{"sql":"select count(*) from owners"}'

# explore the schema without guessing table names
.claude/skills/petclinic-db-cli/db-cli.sh call search_objects \
  --params '{"object_type":"table"}'
```

## 3. Keep the output small

The JSON envelope is verbose. Take only the rows:

```bash
.claude/skills/petclinic-db-cli/db-cli.sh call execute_sql \
  --params '{"sql":"select name from types"}' | jq -c '.data.statements[0].rows'
```

## What the wrapper actually runs

There is nothing magic in it — this is the underlying call, and you can run it
directly if you prefer:

```bash
mcptools call execute_sql --params '{"sql":"select 1"}' \
  npx -y @bytebase/dbhub@1.2.0 --transport stdio \
  --dsn postgres://petclinic:petclinic@localhost:5432/petclinic
```

The wrapper exists only to survive a hostile environment, and every line of it
earns its place from a failure that actually happened:

- `mcptools` lives in `~/go/bin` and `npx` under `nvm` — **neither is on a
  non-interactive agent shell's PATH**, because that shell never sources
  `~/.zshrc`. When mcptools cannot spawn `npx`, the MCP handshake never
  completes and it fails as `Error: initialization timed out`, which looks like
  a broken server rather than a broken PATH.
- On a machine that has never run this version, `npx` **downloads** the package
  on first use, which takes longer than mcptools' ~10s init timeout — the
  identical misleading error, with nothing wrong at all.

If you hit `initialization timed out`, it is almost certainly one of those two.
Do not reinstall `mcptools`; check `command -v npx` first.

## Schema cheat-sheet

`owners`, `pets` (`type_id` → `types`, `owner_id` → `owners`), `visits`
(`pet_id`), `vets`, `specialties`, `vet_specialties`, `users`, `roles`.
Full model: see the ER model section in `CLAUDE.md`.

## Rules

- **Read-only.** No INSERT / UPDATE / DELETE / DDL unless explicitly asked.
- Prefer one aggregated SQL query over several small ones — each call pays a
  ~2s server startup.
- An empty database is usually not a bug: Flyway seeds it when the **backend**
  boots (see `CLAUDE.md` → Database).

## Why not a direct Postgres client

There is deliberately only **one** way into the database: the `dbhub` MCP
server. It is reachable two ways — as an MCP tool where the harness supports
MCP, and through this CLI bridge where it does not. Both hit the same server,
so its guardrails and behaviour are identical either way.
