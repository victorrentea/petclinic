# Frontend Developer Agent — Design Spec

**Date:** 2026-04-26  
**Goal:** Create a Claude Code skill that demonstrates context-isolated agent specialization for Angular frontend work in this project.

---

## Problem

Claude Code skills inject instructions into the main context — no isolation. Copilot's `.github/agents/*.md` files give Copilot true context isolation per agent. Claude Code achieves equivalent isolation via the `Agent` tool, which spawns subagents with their own context window, scoped tools, and independent execution. This skill bridges the gap: it tells the orchestrator (main Claude) when and how to spawn a frontend-specialist subagent.

---

## Solution

A skill at `.claude/skills/frontend-dev/SKILL.md` that:

1. Triggers on `/frontend-dev` or when the user requests Angular/frontend work
2. Instructs the orchestrator to spawn an isolated `general-purpose` Agent
3. The Agent's prompt encodes all Angular conventions for this project
4. The subagent operates only within `petclinic-frontend/` and returns a structured result

---

## Skill Invocation

Trigger: user types `/frontend-dev <task>` **or** any request that clearly involves Angular/frontend work (mentions component, template, UI, CSS, or references files under `petclinic-frontend/`). When in doubt, prefer spawning the subagent over handling it in the main context.

The skill instructs Claude to:
1. Extract the frontend task from the user message
2. Call the `Agent` tool with `subagent_type: "general-purpose"` and a prompt that prepends the full Angular context below
3. Print the subagent's result to the user

---

## Subagent System Prompt (encoded in skill)

The Agent prompt must include:

### Stack
- Angular 16, Bootstrap 3, RxJS, `@angular/material` (snackbar only), `FormsModule`
- No reactive forms — template-driven only (`ngModel`, `#ref="ngModel"`)
- TypeScript, no `any` unless unavoidable

### Module Structure
- Each domain is a feature module: `<entity>.module.ts`, `<entity>-routing.module.ts`, `<entity>.service.ts`, `<entity>.ts` (model)
- Components follow CRUD naming: `<entity>-list`, `<entity>-detail`, `<entity>-add`, `<entity>-edit`
- Declare components in their feature module, not `AppModule`

### Service Pattern
```ts
@Injectable()
export class EntityService {
  entityUrl = environment.REST_API_URL + 'entities';
  private readonly handlerError: HandleError;

  constructor(private http: HttpClient, private httpErrorHandler: HttpErrorHandler) {
    this.handlerError = httpErrorHandler.createHandleError('EntityService');
  }

  getAll(): Observable<Entity[]> {
    return this.http.get<Entity[]>(this.entityUrl)
      .pipe(catchError(this.handlerError('getAll', [])));
  }
}
```
- Always `catchError(this.handlerError(...))` — never let errors propagate uncaught
- Return `Observable<T>`, never subscribe inside the service
- Register service in its feature module's `providers`, not root

### Component Pattern
```ts
@Component({ selector: 'app-entity-list', templateUrl: '...', styleUrls: ['...'] })
export class EntityListComponent implements OnInit {
  entities: Entity[];
  errorMessage: string;
  isDataReceived = false;

  constructor(private service: EntityService, private router: Router) {}

  ngOnInit() {
    this.service.getAll().pipe(
      finalize(() => this.isDataReceived = true)
    ).subscribe(
      data => this.entities = data,
      error => this.errorMessage = error as any
    );
  }
}
```
- Constructor injection only
- Use `finalize()` for loading state, `isDataReceived: boolean` pattern
- Navigation via `this.router.navigate(['/path'])`

### Model Pattern
```ts
export interface Entity {
  id: number;
  field: string;
}
```
- Plain `interface`, never `class`

### Template Pattern
- Bootstrap 3 classes: `container-fluid`, `xd-container`, `form-horizontal`, `form-group`, `col-sm-2`, `col-sm-10`, `col-sm-offset-2`, `btn btn-default`, `table-striped`, `table-responsive`
- Form validation feedback: `[class.has-success]="field.dirty && field.valid"`, `[class.has-error]="field.dirty && !field.valid"`, glyphicon spans, `help-block` error messages
- `*ngIf` / `*ngFor` directives, `[(ngModel)]` two-way binding
- `routerLink` for navigation links, `(click)` for button actions

### Error Handling
- `errorMessage: string` on every component that calls a service
- The global `HttpErrorInterceptor` handles HTTP errors and shows snackbar — do not duplicate

### Routing
- Routes defined in `<entity>-routing.module.ts`, imported into feature module
- Standard paths: `/entities`, `/entities/add`, `/entities/:id`, `/entities/:id/edit`

### Constraints
- Only touch files under `petclinic-frontend/src/`
- Do not modify `app.module.ts` unless adding a new feature module import
- Do not run `npm test` unless the user explicitly asks

---

## Workshop Demo Value

This skill demonstrates:
- **Context isolation** — the subagent has no memory of the parent conversation
- **Specialization** — deep domain knowledge in the prompt vs. generic Claude
- **Tool scoping** — subagent uses Read/Edit/Write/Glob/Grep only on frontend files
- **Comparison point** — equivalent to Copilot's `.github/agents/refactoring.agent.md` but implemented via Agent tool spawning

---

## File to Create

`.claude/skills/frontend-dev/SKILL.md`
