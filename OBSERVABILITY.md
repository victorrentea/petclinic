# Observability

- `./start-grafana.sh` brings up `grafana/otel-lgtm` (Grafana **:3300**, admin/admin; OTLP **:4317/:4318**).
- `./start-backend.sh` attaches the OTel Java agent **only if :4318 is already listening** — start
  Grafana *first*, otherwise the backend runs with telemetry silently disabled.
- Browser spans need a flush window: a scenario that finishes in <~5s closes the page before the
  frontend exporter ships anything, so no frontend traces reach Tempo.
- The agent is pinned at **2.20.1** and told to capture the maximum: SQL unsanitized, **bound
  query parameters** (`db.query.parameter.<n>`, which need `OTEL_SEMCONV_STABILITY_OPT_IN=database/dup`
  and only exist from agent ~2.20 — 2.10 has no such flag). What a sequence diagram *shows* is
  decided at render time in `petclinic-test/` (`SEQ_SQL`, `SEQ_HTTP_BODIES`), never here.
- The agent jar is versioned in its filename — otherwise an already-downloaded
  `opentelemetry-javaagent.jar` makes a version bump a silent no-op.
- `spring.jpa.properties.hibernate.use_sql_comments=true` makes Hibernate prefix each
  statement with the HQL that produced it, so a trace can say which call a bare
  `select … from owners` came from — the agent captures no HQL of its own. It only fires
  for queries *written* as HQL (`@Query`); a Spring Data derived method is assembled
  through the Criteria API and comments itself `/* <criteria> */`, and an entity or lazy
  load carries no comment at all. The sequence diagrams fall back accordingly — see
  `petclinic-test/AGENTS.md`. **A backend started before this property was added labels
  every DB arrow `SELECT petclinic`; restart it and re-record.**
