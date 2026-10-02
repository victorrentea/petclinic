---
base: 4f38a4ecc02bc6df46a0595c0d5ab8cedd824653
audited-base: 4f38a4ecc02bc6df46a0595c0d5ab8cedd824653
audited-head: 12f868550799698089213ef87fa9188de952f614
implementation: 12f868550799698089213ef87fa9188de952f614
head: 12f868550799698089213ef87fa9188de952f614
reviewers: 4 read-only subagent reviewers (correctness, security, ticket-fit, tests), one per lens
harness: copilot-cli
fixed-in: HEAD
---

## Fixed

### Type-mismatch exception reflects unsanitized raw input into log and response
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:80
- source: security reviewer
- severity: medium
- observation: `handleTypeMismatch` builds `detail` from `ex.getValue()` and logs it verbatim; a value containing CR/LF can forge log lines, and the same unsanitized string is echoed back in the 400 response body.
- fix: strip `\r`/`\n` from the value before it is logged or placed in the response.

### Spectral gate fails: `size` schema's `default` is not one of its own `enum` values
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:93
- source: CI
- severity: high
- observation: `@Schema(type="integer", allowableValues={"5","10","20"}, defaultValue="10")` renders `default: 10` (integer) against `enum: ["5","10","20"]` (strings) in the generated `openapi.yaml`; `oas3-valid-schema-example` rejects the mismatch, failing the lint CI job before SonarCloud ever ran.
- fix: drop the annotation's `defaultValue`; the actual runtime default stays enforced by `@RequestParam(defaultValue = "10")` and `OwnerPaging`, only the generated doc's redundant `default:` line is removed. Regenerated `openapi.yaml` and `api-types.ts` (`size?: 5 | 10 | 20` is unchanged).

### `router.navigate`'s returned promise is neither awaited nor marked ignored
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:141
- source: CI (SonarCloud, typescript:S9383, BUG)
- severity: high
- observation: a failed navigation (blocked by a guard, bad route) is silently swallowed; nothing in the code signals that the promise is deliberately not handled.
- fix: mark the call with the `void` operator, as the rule requires.

### `SORTS` membership test uses `Array.includes` instead of a `Set`
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:19
- source: CI (SonarCloud, typescript:S7776, code smell)
- severity: low
- observation: a 4-entry array checked with `.includes()` on every URL parse; a `Set` makes the lookup intent explicit and is O(1).
- fix: declare `SORTS` as a `Set<OwnerSort>` and check membership with `.has()`.

### Generic `.length` assertions instead of `toHaveSize`
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:92, petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:288
- source: CI (SonarCloud, typescript:S5906, code smell)
- severity: low
- observation: `expect(names().length).toBe(n)` reports a less specific failure than Jasmine's own size matcher.
- fix: replaced both with `expect(names()).toHaveSize(n)`.

## Ignored

### Address, Telephone and Pets columns are not sortable
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:39
- source: correctness reviewer, ticket-fit reviewer, tests reviewer (all three raised this)
- severity: medium
- observation: the ticket says every displayed column must be sortable; Address, Telephone and Pets have no sort control.
- why: a deliberate exception the human confirmed in the implementation conversation (requests 5-6), not an oversight.

### Mark class fields as readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:27
- source: CI (SonarCloud, typescript:S2933, code smell)
- severity: low
- observation: Sonar suggests `readonly` on one or more component fields.
- why: `lastName`/`query`/`ownerPage`/`loadFailed` are all reassigned outside the constructor (in `onUrlChange`/`fetch`); `readonly` there is a compile error, not a style choice.

## Assumptions

### Default query-string values are omitted from the URL
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:157
- alternative: always write `page`, `size` and `sort` explicitly so a copied link is self-contained
- confidence: 0.6
- why: readable plain `/owners` link; URL state behavior itself was agreed, this detail was not

### Bad API input (non-5/10/20 size, unparsable page) is split across two exception handlers
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:76
- alternative: let `OwnerPaging` reject everything itself and keep a single handler
- confidence: 0.65
- why: `page=abc` fails Spring's own type coercion before the controller body runs
