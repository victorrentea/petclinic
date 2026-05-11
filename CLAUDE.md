# CLAUDE.md

Full-stack PetClinic — veterinary clinic management (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` — Spring Boot 3.5 REST API (Java 21) → see `petclinic-backend/CLAUDE.md`
- `petclinic-frontend/` — Angular 16 SPA → see `petclinic-frontend/CLAUDE.md`

## Full Stack Commands
Each script is foreground; run in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install
./start-database.sh        # Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080
./start-frontend.sh        # Angular dev server on localhost:4200
./start-observability.sh   # optional observability stack
```

## Domain Model
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties`)
- **User** 1→N **Role**

## API
Backend REST API at `http://localhost:8080/api/` — OpenAPI UI at `/swagger-ui.html`

## General Preferences
- Keep explanations concise
- Challenge ambiguous/wrong prompts
- Never ask before running tests after refactoring

## Task Modifiers
- "fast", "go", "Sparta" → skip build/tests
- "explain and commit" → summarize change as training note
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
