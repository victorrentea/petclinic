# petclinic-test — Claude Notes

- Run all commands from this directory (`petclinic-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
- Layout: `src/` holds the scenarios (`*.spec.ts` + `*.dsl.ts`, `*.feature` + `*.glue.ts`),
  `src/support/` the fixtures/World, `src/seqgen/` the Tempo→PlantUML tooling. Everything a
  run writes goes under `test-results/`.
- ⚠️ `src/*.seq.puml` are **generated** — one per test file, named after it
  (`owner-search.feature.seq.puml`), sectioned by scenario. Never hand-edit: change the test
  and re-run `./run-tests-with-tracing.sh`.
- ⚠️ **Specs in `src/` must not create/delete visits or owners.** `visits.spec.ts` compares the
  *entire* visit list against the API, so a row appearing mid-run fails an unrelated test —
  the suite runs `fullyParallel` against one shared DB.
