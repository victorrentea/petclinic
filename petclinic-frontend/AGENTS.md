# Frontend Agent Guidance

## Common Commands

```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
```

## Architecture
- Angular 16 with Material + Bootstrap 3
- Services communicate with backend REST API at http://localhost:8080/api/
- RxJS for async operations

## Live Search (Search-as-you-type)

- Apply `debounceTime(300)` + `distinctUntilChanged()` + `switchMap()` for any text box that triggers backend calls automatically (no button press).
- Use a `Subject<string>` in the component to feed the RxJS pipeline.
- Empty input can bypass debounce for immediate reset.
- Test with `fakeAsync` + `tick(300)` to assert debounce behavior.

