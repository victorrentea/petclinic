---
ticket: victorrentea/petclinic#37
base: 5dcf16c4
implementation: a8cd9973
reviewers: /code-review high
session: 47d2ba31-61ef-4ef6-ac2f-7d969121ce34
---

## Fixed

### The vet picker could not load on the screens that need it
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VetRestController.java:50
- source: /code-review high (cross-role read on a widened screen)
- fixed-in: HEAD

`GET /api/vets` sat under the class's `hasRole(VET_ADMIN)`, but the booking and edit
forms are owner-admin screens. An owner-admin-only user opening *New Visit* got an error
and a permanently empty combo — the one thing #37 asks for most. `PetTypeRestController`
already solves the identical cross-role read, so this follows it, except narrower: only
`listVets()` moves to `hasAnyRole(OWNER_ADMIN, VET_ADMIN)`; adding, editing and deleting
vets stay VET_ADMIN.

Worth recording how the reviewer's scenario differed from reality. It predicted a 403;
the run produces a **500**, because `ExceptionControllerAdvice`'s catch-all handler
swallows `AuthorizationDeniedException`. Same broken picker, uglier failure. It is also
why the two new assertions live in `BasicAuthenticationConfigTest` and not next to the
controller: `petclinic.security.enable` is `false` everywhere else, so every
`@WithMockUser(roles = …)` in the other suites decorates without enforcing, and a role
test written beside `VetTest` passes whatever the rule says. The first version of this
fix's test did exactly that and proved nothing.

### Booking a visit read the vet's whole specialty list to set one foreign key
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VetRepository.java:19
- source: /code-review high (efficiency)
- fixed-in: HEAD

`VetRepository.findById` `LEFT JOIN FETCH`es `v.specialties`, which is right for the vet
screens and pure waste for `attendingVet`, which reads nothing off the vet but its
identity. Both booking paths now use a lean `findByIdWithoutSpecialties`.

### The Cucumber update step dropped the vet out of its PUT body
- file: petclinic-backend/src/test/java/victor/training/petclinic/functional/VisitSteps.java:95
- source: /code-review high (the PUT-clears-the-vet scenario)
- fixed-in: HEAD

`iUpdateVisitDescription` rebuilt the body from the GET but stopped at `description`, so
after this change renaming a visit unassigned its vet. The step now carries `vetId`
through like every other field, and `visits.feature` gained the scenario that would have
caught it. I kept the endpoint's semantics (see Ignored) and fixed the client, which is
where the defect actually was.

## Ignored

### Make PUT /api/visits/{id} keep the vet when the body omits vetId
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:88
- source: /code-review high (the same finding, its design half)
- severity: medium
- why: "assign only when the field is present" is precisely the bug #37 tells me not to
  repeat.

The endpoint already replaces `date` and `description` unconditionally — a body without
`date` nulls the date. Special-casing `vetId` would make one field in one DTO behave
differently from its neighbours, and telling absent from explicit-null needs a
`JsonNullable` wrapper that nothing else in this codebase uses. The ticket's second
requirement is that clearing the field sticks; unconditional assignment is what makes it
stick.

### Collapse the duplicated attendingVet helper
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:201
- source: /code-review high (duplication)
- severity: low
- why: three lines shared by two controllers that already duplicate the whole booking
  flow; the honest fix is collapsing those, which is a bigger change than #37 asks for.

I first wrote it as one `default` method on `VetRepository`, which is where it belongs.
It fails at runtime: Spring Data's `NullnessMethodInvocationValidator` rejects a null
argument to any repository method, so "no vet chosen" became a 500 — and neither
`org.springframework.lang.@Nullable` nor `org.jspecify.@Nullable` on the parameter talks
it out of that. A `@Component` wrapping one ternary would buy less than it costs.

### A denied @PreAuthorize answers 500 instead of 403
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:75
- source: me, while writing the test for the vet-picker fix
- severity: medium
- why: it is global error handling on every endpoint, and #37 is about a column on visits.

`handleGeneralException` catches `Exception`, which includes
`AuthorizationDeniedException`, so every authorization failure in `rest/` is reported as
an internal error — and the `ProblemDetail` echoes the exception's own message back to
the caller. Worth its own ticket. `ownerAdmin_cannotAddAVet` therefore asserts the write
is refused rather than pinning the status code, so fixing this will not fail it.

### The generated sequence diagram for booking with a vet is orphaned
- file: petclinic-test/generated/add-visit.spec.ts.add-a-visit-attended-by-a-vet.genseq.puml:59
- source: me, reading the repo before starting
- severity: low
- why: regenerating it needs the whole stack traced — browser, backend, Tempo — and the
  frontend's dependencies are not installable here.

This file predates my commit (it arrived with `0d534233` and survived the revert of the
earlier attempt at #37). It deep-links to `add-visit.spec.ts:52` and
`OwnerRestController.bookVisit:193`, neither of which exists, and describes a
`VetRepository.getByIdOrNull` I deliberately did not build. It is stale either way; my
change does not make it staler, and I did not add the e2e test it claims to picture.

### OwnerRestController's constructor is now nine parameters
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:67
- source: me, anticipating SonarCloud java:S107 (this repo lowers the cap to 5)
- severity: low
- why: it was already eight, the ninth collaborator is genuinely needed, and every
  alternative is worse.

Resolving the vet needs a repository, and `mapper → repository` is forbidden by
`docs/packages.puml`. Sonar will re-flag S107 because the constructor's lines changed, so
this will show up as a new-code finding on a pre-existing violation.

### The user manual still describes the visit screens without a vet
- file: user-manual/manual.md:100
- source: me
- severity: low
- why: `manual.md` and its screenshots are regenerated by crawling the running UI, which
  needs the frontend's dependencies installed; hand-editing the prose would leave it
  disagreeing with its own screenshots.

## Assumptions

### vet_id is ON DELETE SET NULL, so deleting a vet is never blocked
- file: petclinic-backend/src/main/resources/db/migration/V4__visit_vet.sql:5
- alternative: the default RESTRICT — a vet who has attended anything can no longer be
  deleted, and `DELETE /api/vets/{id}` starts failing on real data
- confidence: 0.55
- why: #37 says a visit with no vet is normal and "never an error", so a vet's departure
  landing their old visits in that case is the reading that keeps the ticket's own rule
  true. RESTRICT would invent a new failure mode the ticket never asks for.

The index on `vet_id` is there for the same reason, not for searching (which is
explicitly out of scope): without it the FK check behind a vet delete scans `visits`.
It matches how `pet_id` and `owner_id` are already indexed.

The confidence is barely above a coin flip because #37 never mentions deleting a vet at
all — I inferred the rule from a sentence written about booking — and the ticket's own
insistence that historical visits keep their state cuts the other way just as well: a
clinic that wants to know who saw the animal in 2024 would rather the delete failed than
have the answer quietly erased.

### An unknown vetId is a 404, not a quietly unattended visit
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:93
- alternative: the house `petOfId` pattern — build a `Vet` carrying only the id, run no
  query, and let the foreign key reject a bad one as a 500
- confidence: 0.7
- why: `petId` already takes the stub route, so consistency argued for it; correctness
  won. A typo'd vet id is a client error and reads like one, at the cost of one lean
  query per booking.

#37 says nothing about bad input, so none of this came from the ticket — but every other
unknown id in this codebase already answers 404 through `.orElseThrow()`, and only
`petOfId` pulls the other way. That precedent is what holds the number up; the
consistency argument is what keeps it off 0.9.

### A visit with no vet reads "none", and the dropdown offers "-- none --"
- file: petclinic-frontend/src/app/visits/visit.ts:14
- alternative: an em dash, or leaving the cell empty and letting the reader infer
- confidence: 0.9
- why: #37's fourth requirement is that the visit reads as *having none* — not "Unknown",
  not blank-because-broken. A blank cell is indistinguishable from a failed load, which
  is the thing the requirement rules out.

The highest number here, because this is the one decision the ticket argues out loud and
even names the wrong answers. It is not 1.0 only because the ticket dictates the meaning
and not the string: an em dash would satisfy every word of the requirement too.

### The seed gives some visits a vet and deliberately withholds one from others
- file: petclinic-backend/src/main/resources/db/seed/R__seed.sql:118
- alternative: leave every seeded visit unattended, since the ticket only says old rows
  keep no vet
- confidence: 0.45
- why: a demo dataset where nothing has a vet cannot show the feature at all, and one
  where everything does never exercises the "none" rendering. The older batch (the four
  visits on Alice's cats) stays vet-less as the pre-change history; Milton's three cover
  both.

Below a coin flip, and the entry I most expect to be argued with: #37 does not mention
the seed, and its sentence about pre-existing rows keeping no vet reads, taken strictly,
as an instruction to leave the dataset alone. I weighted demo value over that strict
reading, and which vet got which visit is invention with no source but my own taste.

### The vet rides on VisitDto as three flat fields, not a nested VetDto
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/dto/VisitDto.java:46
- alternative: `vet: VetDto`, the shape the vet screens already speak
- confidence: 0.8
- why: `VisitDto` already flattens the owner into `ownerId`/`ownerFirstName`/
  `ownerLastName`, and a nested `VetDto` carries `specialties`, which would put a vet's
  whole specialty list on every row of the all-visits table.

### MCP's create_visit and the chatbot were left alone
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:48
- alternative: read "everywhere throughout the app" to include the MCP surface and let the
  assistant book with a vet
- confidence: 0.6
- why: the ticket's own four requirements name the booking form, the edit form, the
  owner's page and the all-visits screen. The MCP tools keep booking without a vet, which
  is a valid visit under this change, so nothing there breaks.

The number is low because #37 contradicts itself on exactly this point: its opening line
says the vet should show "everywhere throughout the app", and its third requirement then
narrows that to "today that means the owner's page and the all-visits screen". I took the
narrowing as the operative one, but `list_visits` does show an owner their visits with
details, so a reader who weights the opening line will say I left a screen out.

### Two generated files were written by hand because their generators cannot run here
- file: petclinic-frontend/src/app/generated/api-types.ts:346
- alternative: leave them stale and let CI's regenerate-and-auto-commit fix them
- confidence: 0.85
- why: stale TS types mean `visit.vetId` does not compile, so the working tree would not
  build for anyone who pulled it.

`npm ci` and `pip install` are both blocked in this environment, so
`npm run generate:api` could not run. `api-types.ts` was written to match
`openapi-typescript`'s output exactly. `DB.puml` was too — and that one is verified: the
pre-commit hook bootstrapped its own venv, regenerated the file, and staged a result
byte-identical to what I had written. The frontend's Karma suite and `ng build` could not
be run at all for the same reason; the backend suite, Spotless and every guardrail test
are green.

This entry is a confession about the environment, not a reading of #37, so its number
scores something narrower than the others: how sure I am that hand-writing beat leaving
the files stale. Quite sure — stale types break the build for whoever pulls next — and
`DB.puml` came back byte-identical from the real generator, which is as close to proof as
this gets. It is not higher because `api-types.ts` got no such check.


## Taken over without a new pass — 21 Sep 2026

The 32 commits below landed after the review commit `ce56d912` and were folded into this
review point by Victor's decision, without re-running the reviewers. The findings and
the assumptions above still describe the branch as it stood at `ce56d912`; none of them
was re-read against these commits. What they are:

- 6ef4ae6b Rename the no-vet scenario: a visit need not be set a vet
- f9f9faa4 Make DTO setters fluent (return this) and chain DTO construction
- e9079d6f ci: an empty AGENTS.md is not a symlink stub
- 374cefee ci: an empty AGENTS.md is not a symlink stub
- 226755c3 Use a raw <select> for the vet on the edit form, on purpose, so the design-system audit has a gap to show
- f2b2dae7 Rate the assumptions: how sure the author was of each reading
- 7ea4affd Redraw the sequences without the empty JDBC arrows
- 0a3541e5 VisitTest goes back to a plain @SpringBootTest, with no server to post to
- c4b0df32 genseq: drop JDBC spans that carry no statement
- d0d57219 Send the fake SMS in-process again: keep the test instrumentation out of production code
- 5434391d genseq: drop JDBC spans that carry no statement
- b5606c1b Send the fake SMS in-process again: keep the test instrumentation out of production code
- b0203286 human-review: let the design-system audit start its own two builds
- bddf3e4f human-review: let the design-system audit start its own two builds
- e9e23b6a Record the sequence diagrams with the SMS gateway self-call
- abf1c951 Give VisitTest a server to post the fake SMS to
- 4aea32fc Send the fake SMS over HTTP, so the trace crosses a real socket
- fff6bd15 Send the fake SMS over HTTP, so the trace crosses a real socket
- 3a504b69 Revert "Require one Gherkin scenario through the UI per feature"
- 2f5947ea Revert "Require one Gherkin scenario through the UI per feature"
- 619902c3 pre-commit: spotless only on the staged files
- 2265f333 pre-commit: spotless only on the staged files
- 6aac04b4 Drop the tests that proved clearing the vet persists, to show an unproven requirement
- 9ce98ab9 Log the booked visit id and the attending vet
- f96259dc Require one Gherkin scenario through the UI per feature
- 71b7cb2e Require one Gherkin scenario through the UI per feature
- 0bb6f069 test: Gherkin UI scenario for the vet-linking story
- 21680c35 Record the sequence diagrams of the vet-linking tests
- 31297ed4 chore(codecity): commit the regenerated city the guardrail asks for
- 7cad86b1 test(visits): click the vet through the browser, not just past the API
- 753f724c Let the review run start the stack its film is recorded against
- d13449ea Let the review run start the stack its film is recorded against

The point this page counts "after the agent finished" from is now `6ef4ae6b`.
