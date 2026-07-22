# petclinic-ui-test — Claude Notes

- Run all commands from this directory (`petclinic-ui-test/`).
- Backend: `localhost:8080`, frontend: `localhost:4200` — both must be up before `npm test`.
- `npm run test:with-apps` auto-starts both apps, but is experimental; prefer starting apps manually.
- Screenshots land in `test-results/screenshots/` (git-ignored, auto-generated).
- Docker cleanup when things break: `docker-compose -f docker-compose.test.yml down -v`
