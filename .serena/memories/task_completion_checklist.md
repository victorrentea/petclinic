# Task Completion Checklist

## Frontend Development (TypeScript/Angular)

### Before Committing
1. **Lint**: `ng lint` or `npm run lint`
2. **Test**: `ng test` or `npm test` (or headless: `npm run test-headless`)
3. **Build**: `ng build` to verify no build errors
4. **Manual test**: Verify in browser at http://localhost:4200

### Long Tasks (>5 seconds)
- Play completion chime: `afplay /System/Library/Sounds/Glass.aiff`

### Special User Commands
- **"fast"/"go"/"Sparta"** - Skip build/tests
- **"explain and commit"** - Summarize change as training note
- **After commit** - Auto-push if:
  - Git username is `victorrentea`
  - Repo is under `github.com/victorrentea`

### Refactoring
- ALWAYS run tests after refactoring
- Verify no regressions

## Backend Development (Java/Spring Boot)
See backend-specific memory if needed.

## General
- Keep explanations concise
- Use bullet lists/tables
- Challenge ambiguous prompts
- Ask questions when unclear
