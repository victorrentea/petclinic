---
base: b12c9bdb53b66c0f86b25bc07c2f4b55a76f9e04
implementation: bac07e4c8323faf459992486c772f29043bae8bd
reviewers: claude-opus-4.8 adversarial audit of 83754839, reused with human approval; excludes bac07e4c housekeeping
fixed-in: HEAD
---

## Fixed

The reused Opus audit required no additional corrections.

## Ignored

### Unknown query parameters need not be stripped
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:116
- source: Opus 4.8 adversarial audit, rejected candidate
- severity: low
- why: The specification constrains known settings; unrelated query parameters do not invalidate the grid.

### Empty sort direction cannot originate from the rendered controls
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:28
- source: Opus 4.8 adversarial audit, rejected candidate
- severity: low
- why: Sort clearing is disabled; the defensive guard does not break reachable user interactions.

## Assumptions

### Apply the requested direction to every ordering tie-breaker
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListParameters.java:40
- source: implementation decision
- why: Uniform direction gives deterministic ordering and permits forward or backward index traversal.
- alternative: Keep owner IDs ascending even when the primary sort is descending.
- confidence: 0.84

### Add history entries for changed settings, but not identical submissions
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:114
- source: implementation decision
- why: Users can retrace grid choices without duplicate history entries for unchanged settings.
- alternative: Replace the current history entry after every grid action.
- confidence: 0.88

### Identical search submissions reload data once
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:107
- source: implementation decision
- why: Preserve existing search behavior while allowing refreshed data without changing the URL.
- alternative: Ignore submissions whose applied settings are unchanged.
- confidence: 0.94

### Stable column proportions instead of fixed pixel widths
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:74
- source: implementation decision
- why: Responsive proportions prevent sort jitter while retaining every column on smaller screens.
- alternative: Fix column widths in pixels regardless of viewport.
- confidence: 0.79

### Reset every invalid URL setting and explain the correction
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:72
- source: human
- why: Victor explicitly chose defaults with a visible explanation instead of an unrepaired error.
- alternative: Display an error and leave the invalid URL unchanged.
- confidence: 1.0

### Share submitted search prefixes, never unsubmitted draft text
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:55
- source: human
- why: Victor confirmed that shared links must restore the same filtered results.
- alternative: Persist only pagination and sorting, excluding the search.
- confidence: 1.0

### Restrict sorting to Name and City
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListParameters.java:41
- source: human
- why: Victor explicitly narrowed the original any-column request to meaningful Name and City orderings.
- alternative: Also sort Address, Telephone, and nested Pets.
- confidence: 1.0
