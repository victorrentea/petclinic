---
base: 4f38a4ecc02bc6df46a0595c0d5ab8cedd824653
implementation: 12f868550799698089213ef87fa9188de952f614
reviewers: four read-only reviewer subagents: correctness, security, ticket-fit, tests
fixed-in: HEAD
---

## Fixed

### Page-size schema mismatch blocked the push gate
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:93
- source: pre-push hook
- severity: high
- why: Removed the string-valued enum metadata; runtime validation still restricts sizes to 5, 10, or 20.
- fixed-in: HEAD

### Invalid query values could forge log lines
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:79
- source: security reviewer
- severity: medium
- why: Omit untrusted values from logs and error responses to prevent newline log forging.
- fixed-in: HEAD

### Add-visit setup searched only the first owner page
- file: petclinic-test/src/add-visit.dsl.ts:18
- source: ticket-fit reviewer
- severity: low
- why: Search every page instead of assuming a pet owner appears among the first 20.
- fixed-in: HEAD

## Ignored

### Page changes do not create separate browser history entries
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:141
- source: ticket-fit reviewer
- severity: low
- why: The human explicitly chose replaceUrl so paging does not add a Back-button step per page.

## Assumptions

### Batch lazy pet and visit loading instead of paginated collection joins
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Owner.java:56-58
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Pet.java:50-52
- alternative: Fetch-join pets and visits in the paginated owner query.
- confidence: 0.85
- why: Collection joins can duplicate owners and corrupt page boundaries; Hibernate batching avoids that.
