# CLAUDE.md

Full-stack PetClinic — Angular 16 frontend (`petclinic-frontend/`) + Spring Boot 3.5 backend (`petclinic-backend/`), Java 21.

## Common Commands

Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install for all modules
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080
./start-frontend.sh        # Angular dev server on localhost:4200
./start-mcp.sh             # optional: Spring AI MCP server on localhost:8090
./start-observability.sh   # optional: Grafana LGTM (Ctrl+C tears it down)
```

## Architecture

See [GUARDRAILS.md](GUARDRAILS.md) for guardrail tests, living architecture diagrams, and CI drift checks.

## CI Monitoring
After `git push`: run `gh run list --branch <branch> --limit 1` to get the run ID, then `gh run watch <run-id> --exit-status` in background. On failure, investigate with `gh run view <run-id> --log-failed` and fix if related to current task.

## Task Modifiers
- Use red-green TDD
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
