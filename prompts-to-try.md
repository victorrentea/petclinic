### Context Hygiene & Progressive Disclosure Pattern

- Remove from CLAUDE.md the obvious mvn and npm instructions that any LLM knows from its training data
- Replace in CLAUDE.md the redundant (soon drifting) "## API Endpoints" with a pointer to the openapi.yaml (auto-kept in sync by tests)
- Extract from CLAUDE.md the backend-related rules into a nested petclinic-backend/CLAUDE.md (which will be injected automatically in your context when stepping in that subfolder)
- Extract from CLAUDE.md the "### Java Code Style" into a java/SKILL.md since those rules are only required when writing or reviewing .java. To guarantee the skill activates before touching any java file, add to the skill's frontmatter "paths: petclinic-backend/**/*.java"
- Replace the drifting "## Domain Model" with an url that renders a plantuml image from petclinic-backend/docs/generated/DomainModel.md
- Check CLAUDE.md is non-contradictory and in sync with recent code changes

### Tools (after accepting .mcp.json)

- **UI Layout fix:** align the labels and values in owner details screen via playwright screenshots
- **FE+BE bug:** reproduce bug gh#40 in browser, write a failing e2e playwright test, fix bug -> test passes
- **QA:** explore the application using playwright test agents at https://playwright.dev/docs/test-agents
- **Docs:** /regen-user-manual to update the [user manual](user-manual/manual.md)
- **Ops:** create a Grafana dashboard with things to monitor in this app, then open it in a browser (start Grafana docker if necessary)
- **Ops:** break down the time budget for a click on search owners button from recorded traces in Grafana
- **BE:** optimize "search owners by last name" query
- **BI:** Export an Excel pie chart of the pet types, from my postgres-db
- **SQL:** Make backend tests run faster (I know it might take you some serious time & tokens)
- **Life:** Get issues assigned to me on this Git repo - help me connect you to the tools you need. Write a skill ± script to get them faster tomorrow.
- **Logs:** Get last errors from staging environment.
- **Harness tweak:** Set me up an End hook that plays a sound when you end your turn

### Bring to your project❤️

Start agent in YOUR project's folder and tell it:

From https://github.com/victorrentea/petclinic repo...
- ... get the mechanism to keep package.puml in sync with code
- ... get the mechanism to generate DomainModel.puml from code
- ... get the DB.puml from the incremental scripts
- ... run the CodeCity representation on my source code
- ... configure my agent cli a status bar as per 'victor-statusbar.md'
- ... get the mechanism to keep the Backend Java code in sync with openapi.yaml and/or with Frontend api-types.ts
- ... get the tripwire that tells the agent that if its push broke build, it should stay in a loop until CI is green
- ... adopt the githooks concept: run critical guardrail tests before any push, plus remotely in the CI workflow, against AI 'accidentally' pushing with --no-verify
- ... adopt the CODEOWNERS for protecting critical files, forcing review by the tech lead, to prevent dev's fatigue-LGTM
- ... get the 'generated_sequences/*.puml' idea and help me set it up in my cross-microservices e2e tests in staging / my cross-module e2e tests of my modulith
- ... create me 3 functional .feature tests for the most critical business rules of this project (in your opinion) to be able to confirm them with business and QA
