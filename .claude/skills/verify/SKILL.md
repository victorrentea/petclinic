---
name: verify
description: How to verify a petclinic change at runtime - which servers to start, how to make the running backend pick up new code, and how to drive the API and the Angular UI to capture evidence.
---

# Verifying petclinic at runtime

## Bring the stack up (each foreground, own terminal / background task)
```sh
./start-database.sh     # ⚠️ rm -rf data first: wipes runtime rows. Skip if Postgres already runs on :5432
./start-backend.sh      # notification-service :8090 + backend :8080, wait for "✅ started"
./start-frontend.sh     # ng serve on http://127.0.0.1:4200/petclinic/
```
Already running? The backend runs with devtools: `cd petclinic-backend && mvn -q compile` makes it reload
the current checkout (Flyway runs new migrations on that reload). `ng serve` reloads frontend edits by itself.
After switching branches, recompile, or the backend keeps serving the old code.

## Drive it
- **API**: `curl -s localhost:8080/api/...` (owners list/search is `permitAll`-free in dev; no auth needed locally).
- **UI**: a throwaway Playwright script run from `petclinic-test/` (it has `playwright` installed):
  `node verify-tmp.mjs` using `chromium.launch()`, base URL `http://127.0.0.1:4200/petclinic/...`;
  screenshot into the session scratchpad, delete the script afterwards. Print URL + visible rows per step:
  the URL carries the grid state (`?lastName=&page=&size=&sort=`).
- **Data**: read with `.claude/skills/db-cli/db-cli.py call execute_sql --params '{"sql":"..."}'`.

## Gotchas
- A Playwright *test* run (`npx playwright test`) resets the shared dev DB to its fixtures and
  `add-owner.spec.ts` leaves "Ada Acceptance…" owners behind on purpose - clean them after.
- Tooltips are the design-system bubble `.app-tooltip.visible` (no native `title`); hover ~150 ms first.
