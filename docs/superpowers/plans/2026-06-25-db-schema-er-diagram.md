# DB Schema → ER Diagram Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Generate `petclinic-backend/docs/generated/DbSchema.puml` (PlantUML ER diagram) from `DB.sql`, with the current commit's schema delta highlighted in red, wired into the pre-commit hook.

**Architecture:** A Python script parses `DB.sql` with sqlglot into a schema model, diffs it against the previous committed schema (`git show HEAD:DB.sql`), and emits a deterministic PlantUML ER diagram with red markers on changed elements. A pre-commit step regenerates + stages it when `DB.sql` is staged; pre-push adds a consistency guard.

**Tech Stack:** Python 3.12, sqlglot (pinned), bash hooks, PlantUML (entity notation).

## Global Constraints

- Source of truth: `DB.sql` at repo root.
- Output: `petclinic-backend/docs/generated/DbSchema.puml`.
- Exclude `flyway_schema_history`.
- Deterministic output (sorted tables, FK lines); same inputs ⇒ byte-identical.
- Red = commit-scoped diff vs `HEAD:DB.sql`; bootstrap (no `HEAD:DB.sql`) ⇒ no red.
- Generation in pre-commit only; never in an always-on `mvn test` extractor.

---

### Task 1: Script scaffolding + venv bootstrap

**Files:**
- Create: `petclinic-backend/docs/scripts/requirements.txt`
- Create: `petclinic-backend/docs/scripts/.gitignore`
- Create: `petclinic-backend/docs/scripts/gen-db-schema-diagram.sh`

- [ ] requirements.txt pins `sqlglot==30.11.0`.
- [ ] `.gitignore` contains `.venv/`.
- [ ] `gen-db-schema-diagram.sh`: create `.venv` if missing, `pip install -r requirements.txt -q`, resolve baseline (`git show HEAD:DB.sql` to a temp, empty if absent), resolve current (arg or `DB.sql`), invoke `python db_schema_to_puml.py --current … --baseline … --out …`. Idempotent, quiet on cache hit.
- [ ] Commit.

### Task 2: Parser → schema model (TDD)

**Files:**
- Create: `petclinic-backend/docs/scripts/db_schema_to_puml.py`
- Test: `petclinic-backend/docs/scripts/test_db_schema_to_puml.py`

**Produces:** `parse_schema(sql: str) -> Schema` where `Schema` has `.tables: dict[str, list[Column]]` (Column = name,type,notnull,pk,fk), `.fks: list[Fk]` (Fk = table, cols, ref_table, ref_cols). Flyway table excluded.

- [ ] Test: parse current `DB.sql` ⇒ 9 tables (10 minus flyway), `owners` has 6 columns, `pets` FK → `owners` and → `types`, `visits` FK → `pets`. Verify exact sqlglot AST accessors empirically.
- [ ] Implement `parse_schema`. Run tests green. Commit.

### Task 3: Diff + PlantUML emit (TDD)

**Files:** same script + test.

**Produces:** `diff_schemas(base, cur) -> Delta`; `render_puml(cur, delta) -> str`; `main(argv)`.

- [ ] Test: baseline==current ⇒ output has all entities, FK lines, **no** `red`/`<color:red>`.
- [ ] Test: synthetic diffs — add column, add table, add FK, change type, drop column ⇒ red markers on exactly those, nowhere else.
- [ ] Test: determinism — two runs identical bytes.
- [ ] Implement diff + render + CLI. Run tests green. Commit.

### Task 4: Generate the initial diagram

- [ ] Run wrapper against current `DB.sql` (baseline==current) ⇒ `DbSchema.puml`, no red.
- [ ] Eyeball validity (optional `plantuml` render). Commit `DbSchema.puml`.

### Task 5: Wire pre-commit hook

**Files:** Modify `.githooks/pre-commit`.

- [ ] After the openapi/TS step, add: if `DB.sql` staged ⇒ run wrapper, `git add petclinic-backend/docs/generated/DbSchema.puml`. Skip gracefully if python3 missing.
- [ ] Manually simulate (stage a tweaked `DB.sql`, run hook body) ⇒ puml regenerated + staged with red. Revert. Commit hook.

### Task 6: Wire pre-push guard + GUARDRAILS

**Files:** Modify `.githooks/pre-push`, `GUARDRAILS.md`.

- [ ] pre-push: if pushed commits touched `DB.sql` but not `DbSchema.puml` ⇒ block with actionable message. No regeneration.
- [ ] Add a GUARDRAILS row. Commit.

### Task 7: End-to-end verification

- [ ] Add a column to `DB.sql`, run pre-commit body ⇒ red on that column; confirm drift check + guard behave. Revert test change. Final commit if needed.
