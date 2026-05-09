# User Manual Generator — Design

**Date:** 2026-05-09
**Status:** Approved for planning

## Goal

Provide a quickly-scannable user manual for the PetClinic application, regenerated on demand by a Claude-driven slash command that explores the running app via the browser.

## Output

Single Markdown file plus a flat folder of screenshots.

```
docs/manual/
  manual.md              ← TOC + every section inline
  screenshots/
    owners-list.png
    owners-detail.png
    owners-create.png
    pets-add.png
    visits-list.png
    ...
```

Screenshot filenames: `<feature>-<state>.png` (lowercase, hyphenated). One screenshot per documented step, not per page.

## Audience and Depth

- **Audience:** end users (clinic staff). Instructional second-person prose: "Click *Add Owner* to register a new owner."
- **Depth:** walkthrough. For each feature, document the happy path (list → detail → create/edit). Target 3-5 screenshots per feature, ~30-50 total. Skip exhaustive form-field reference, validation errors, and edge cases.

## Section template

```markdown
## <Feature name>

One paragraph describing what this area is for and what you can do here.

### Viewing the list
![](screenshots/<feature>-list.png)
Step-by-step prose for the read path.

### Creating a new <thing>
![](screenshots/<feature>-create.png)
Step-by-step prose for the write path.
```

## Regeneration mechanism

A project-scoped Claude slash command at `.claude/commands/regen-manual.md`. Invoked as `/regen-manual`. Uses the `chrome-devtools-mcp` plugin (already installed) for navigation and screenshot capture.

### Pre-flight

The command does NOT start the stack. It verifies:

- `http://localhost:4200` returns 200 (frontend up)
- `http://localhost:8080/actuator/health` returns 200 (backend up)

If either fails, abort with the hint: "Start the stack first with `./run-all.sh`."

### Diff-based regeneration

The prior manual is treated as a baseline checklist, not a starting point to overwrite. This:

- Prevents Claude from forgetting to document a screen that was previously documented.
- Keeps prose stable across runs when nothing changed (avoids LLM-induced churn).
- Produces minimal, reviewable diffs.

Flow:

1. **Load baseline.** If `docs/manual/manual.md` exists, parse it to extract:
   - Section headings (the documented feature inventory)
   - Screenshot filenames referenced
2. **Discover structural truth.** Read `petclinic-frontend/src/app/app-routing.module.ts` and the per-feature `*-routing.module.ts` files to enumerate the live route inventory.
3. **Reconcile baseline vs. current routes:**
   - **Route in baseline AND in code:** existing feature — visit it, compare current screen against prior screenshot.
     - Visually unchanged → keep prose verbatim, keep screenshot.
     - Visually changed → update prose for what's new, replace screenshot.
   - **Route in code, not in baseline:** new feature — add section, write fresh prose, capture screenshots.
   - **Route in baseline, not in code:** removed feature — delete section, delete orphan screenshots.
4. **Rebuild TOC** at top of `manual.md` reflecting the final section order. Order follows route order in `app-routing.module.ts`.
5. **Report** a one-line summary: `Manual regenerated: 1 new section (invoice), 2 updated (owners, visits), 0 removed, 4 screenshots replaced.`

### Visual comparison heuristic

Claude compares prior vs. current by viewing both screenshots side by side. No pixel diffing — judgment call: did the layout, labels, or content meaningfully change? Cosmetic noise (different sample data, scrollbar position) does not count as a change.

### Screenshot capture details

- Viewport: 1280×800
- Format: PNG, full-page capture
- Every screenshot is freshly captured during regeneration (no cache), but only written to disk if it would replace an unchanged-purpose screenshot or add a new one.

## Defaults locked in

- Authentication: documents the default no-security state. If `petclinic.security.enable=true` is added later, the manual gains a Login section in a future regen — out of scope for the initial version.
- Sample data: the manual relies on the app's auto-populated H2/Postgres seed data for screenshots. Walkthroughs reference seeded entities (e.g., owner "George Franklin") where convenient.
- No CI integration. The manual is human-curated content refreshed on demand, not a CI artifact.

## Non-goals

- Reference documentation of every form field
- Documenting validation error messages
- Documenting REST endpoints or developer-facing concerns (covered by Swagger UI and `CLAUDE.md`)
- Localization (English only)
- Browser-compatibility notes
- Auto-running on commit, on push, or in CI

## Files added

- `docs/manual/manual.md` — initial empty stub committed alongside the slash command, populated on first `/regen-manual`
- `docs/manual/screenshots/.gitkeep`
- `.claude/commands/regen-manual.md` — the slash command prompt

## Files NOT added

No source-code changes. No new tests. No new dependencies. No CI workflow changes.

## Open risks

1. **Brittleness of route discovery.** If the routing modules are refactored to use a registry, dynamic paths, or guards that hide routes, the discovery step misses sections. Mitigation: Claude can fall back to crawling the rendered DOM (sidebar/menu links) if route parsing produces a suspiciously short list.
2. **Visual-change false positives.** Random sample data per app start may make every run look "changed." Mitigation: the comparison heuristic explicitly ignores data variance; only structural/label changes count.
3. **Long regen time.** ~30-50 screenshots through `chrome-devtools-mcp` is several minutes. Acceptable for a manually-triggered command.
