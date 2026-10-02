---
base: 4f38a4ecc02bc6df46a0595c0d5ab8cedd824653
audited-base: 4f38a4ecc02bc6df46a0595c0d5ab8cedd824653
audited-head: 12f868550799698089213ef87fa9188de952f614
implementation: 12f868550799698089213ef87fa9188de952f614
head: 12f868550799698089213ef87fa9188de952f614
reviewers: 4 parallel read-only subagents (correctness, security, ticket-fit, tests), each given only its brief and the diff
harness: Copilot CLI
fixed-in: HEAD
---

## Fixed

### `size` schema mixed integer type with string enum, failing Spectral
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:93
- source: CI
- severity: high
- fixed-in: HEAD

### `router.navigate` promise left unhandled, floating-promise bug
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:141
- source: CI
- severity: high
- fixed-in: HEAD

## Ignored

### Owner list `page` has no upper bound, enabling large-offset DB scans
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPaging.java:25
- source: security reviewer
- severity: medium
- why: deep paging was explicitly ruled out of scope in the interview (Request 9)

### Paging bar and table rows desync while a page/sort/size change loads
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:100-110
- source: ticket-fit reviewer
- severity: medium
- why: the human agreed to keep the old page visible until the new one arrives (Request 13)

### Migration rewrites and reindexes `owners` with no lock-safety at 100k-row scale
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_sorting.sql:2
- source: ticket-fit reviewer, tests reviewer
- severity: high
- why: ICU collation needs a full rewrite; true zero-downtime migration is a separate, unscoped task

## Assumptions

### E2E coverage narrowed to page 1 only, no scenario added for page 2+
- file: petclinic-test/src/owner-search.feature:25
- alternative: keep an "every owner" scenario by adding a second request for later pages
- confidence: 0.4
- why: the API change forced dropping "lists every owner", but extending coverage to page 2+ was never raised with the human
