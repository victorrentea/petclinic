### Context Hygiene & Progressive Disclosure Pattern
- Remove from AGENTS.md the obvious mvn and npm instructions that any LLM knows from its training data
- Replace in AGENTS.md the redundant (soon drifting) "## API Endpoints" with a pointer to the openapi.yaml (auto-kept in sync by tests)
- Extract from AGENTS.md the backend-related rules into a nested petclinic-backend/AGENTS.md (which will be injected automatically in your context when stepping in that subfolder)
- Extract from AGENTS.md the "### Java Code Style" into a java/SKILL.md since those rules are only required when writing or reviewing .java. To guarantee the skill activates before touching any java file, add to the skill's frontmatter "paths: petclinic-backend/**/*.java"
- Replace the drifting "## Domain Model" with an url that renders a plantuml image from petclinic-backend/docs/generated/DomainModel.md
- Check AGENTS.md is non-contradictory and in sync with recent code changes
 
### Tools & MCPs (after accepting .mcp.json)   
- **UI Layout bug:** align the labels and values in owner details screen via playwright screenshots
- **BE tuning:** Make backend tests run faster (I know it might take you some serious time & tokens)
- **BI dream:** Export an Excel pie chart of the pet types, from my postgres-db
- **Query tuning:** the "search owners by last name" query does a full table scan — profile it with the postgres-db MCP (EXPLAIN ANALYZE) and optimize its performance
- **FE+BE bug:** reproduce bug gh#40 in browser, write a failing e2e playwright test, fix bug -> test passes
- **QA:** explore the application using playwright test agents at https://playwright.dev/docs/test-agents 
- **Mandated docs:** /regen-user-manual to update the [user manual](user-manual/manual.md)
- **Ops for all:** create a Grafana dashboard with things to monitor in this app, then open it in browser
- **Time Tracing:** break down the time budget for a click on search owners button, extracting this from recorded traces in Grafana

### Copy 
In YOUR project folder, tell your agent:

From https://github.com/victorrentea/petclinic repo...
- ...get the mechanism to keep package.puml in sync with code
- ...get the mechanism to generate DomainModel.puml and DB.puml
- ... run the codecity representation on my project 
- ... configure me the 'victor-statusbar.md' in my Claude
- ... get the mechanism to keep the Backend Java code in sync with openapi.yaml and/or with Frontend api-types.ts
- ... get the tripwire that tells the agent that after a push it should stay in a loop until CI is green
- ... get the githooks idea: run one critical guardrail test before push, and remotely in the CI workflow (against AI 'accidentally' pushing with --no-verify)
- ... get the CODEOWNERS idea and set it up in this project to guard a couple of critical files, forcing review by the tech lead (against dev's fatigue-LGTM)
- ... get the 'generated_sequences/*.puml' idea and help me set it up in my cross-microservices e2e tests in staging / my cross-module e2e tests of my modulith
- ... create me 3 functional .feature tests for the most critical business rules of this project (in your opinion) to be able to confirm them with business and QA
- Set me up an End hook that plays a sound when you end your turn
