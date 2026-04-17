# Testing Guidelines — Frontend (Angular / Jasmine)

## General Style

- Use **Jasmine** matchers (`expect(…).toBe(…)`, `toEqual`, `toHaveBeenCalledWith`).
- Keep specs focused: one `describe` block per component or service, one `it` per behavior.
- Use **constants** to document intent behind magic values.
- Never reproduce business logic from `src/app` inside spec files.
- Use **spies** for services injected into the component under test — never instantiate real HTTP clients.

## Component Tests (`TestBed`)

- Configure `TestBed` with only the providers/imports the component strictly needs.
- Prefer `NO_ERRORS_SCHEMA` or stub child components to isolate the component under test.
- Call `fixture.detectChanges()` after setting inputs or triggering async operations.

## Service Tests with HTTP

- Use `HttpClientTestingModule` + `HttpTestingController` — never mock `HttpClient` directly.
- Flush the expected request with `expectOne(url).flush(mockData)`.
- Always call `httpMock.verify()` in `afterEach`.

## Live Search / Debounce Tests

- Use `fakeAsync` + `tick(300)` to assert debounce behavior without real timers.
- Feed search terms through the `Subject<string>` used by the component, not directly to the service.
- Test that emissions below `debounceTime` threshold do **not** trigger a backend call.
- Test that changing the term rapidly (via `distinctUntilChanged`) fires only one request.

## What NOT to Do

- Do not use `async/await` with `fakeAsync` — pick one.
- Do not test template HTML details (CSS classes, exact copy) — test behavior and data bindings.
- Do not import the full `AppModule` in unit tests — it defeats isolation.

