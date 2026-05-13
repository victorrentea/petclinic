# Frontend — CLAUDE.md

Angular 16 SPA with Bootstrap 3, rooted at `petclinic-frontend/`.

## Commands
```sh
npm start                # Dev server (localhost:4200)
npm run build            # Production build
npm test                 # Karma tests
npm run test-headless    # Headless Chrome tests
npm run e2e              # Protractor e2e tests
```

## Architecture

- Angular 16 + Bootstrap 3 + RxJS
- `FormsModule` (template-driven forms only — no ReactiveFormsModule)
- `@angular/material` used only for `MatSnackBarModule` (globally wired — do not add more)
- Services communicate with backend REST API at `environment.REST_API_URL`

**Module structure** — each domain in its own feature module:
```
src/app/<entity>/
  <entity>.module.ts
  <entity>-routing.module.ts
  <entity>.service.ts
  <entity>.ts              # model interface
  <entity>-list/
  <entity>-detail/
  <entity>-add/
  <entity>-edit/
```

## Code Preferences

- Constructor injection only — never use `inject()`
- Always `catchError(this.handlerError(...))` in services — never omit
- Return `Observable<T>` from services — never subscribe inside a service
- `errorMessage: string` field on every component that calls a service
- Bootstrap 3 only — no Bootstrap 4/5 classes
- Use `glyphicon` for icons

For paginated/sortable/searchable list pages, see the `grid` skill.
