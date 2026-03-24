# AGENTS.md — Frontend (Angular 16)

## Fast paths
- Dev server: `npm start` → http://localhost:4200
- Tests: `npm test` or `npm run test-headless`
- Production build: `npm run build`
- e2e: `npm run e2e` (Protractor)

## Architecture
- Feature modules under `src/app/`: `owners/`, `pets/`, `visits/`, `vets/`, `specialties/`, etc.
- `app.module.ts` wires feature modules + global `HttpErrorInterceptor` (surfaces backend errors via Material snack bars).
- Feature services build URLs from `environment.REST_API_URL`; both `environment.ts` and `environment.prod.ts` point to `http://localhost:8080/api/`.
- Example pattern: `owners/owner.service.ts` performs CRUD with `HttpClient` + shared error handling from `error.service.ts`.
- Forms are template-driven (`FormsModule`); favor existing patterns over reactive-form rewrites unless required.

## Guardrails
- When changing API calls, verify the backend base URL still matches the environment in use.
- Do not introduce reactive forms unless the task explicitly requires it.

