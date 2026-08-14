# petclinic-test — Claude Notes

- Run all commands from this directory (`petclinic-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- ⚠️ **Specs in `src/` must not create/delete visits or owners.** `visits.spec.ts` compares the
  *entire* visit list against the API, so a row appearing mid-run fails an unrelated test —
  the suite runs `fullyParallel` with 5 workers against one shared DB. Put write-path coverage
  in the backend suite (`VisitTest` & co.), where each case rolls back its own transaction.
- Page objects must wait for **data**, not just the `h2`: `open()` waits for the first row, since
  the heading renders before the request resolves — read too early and you either see an empty
  table or let the in-flight response repaint over a filtered list.
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
- Layout: `src/` holds the scenarios (`*.spec.ts` + `*.dsl.ts`, `*.feature` + `*.glue.ts`),
  `src/support/` the fixtures/World, `scripts/trace-diagram/` the Tempo→PlantUML tooling,
  `generated_sequences/` the two committed `.puml` files. Everything a run writes goes under
  `test-results/`.
