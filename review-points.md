---
base: d99781fb43c2b1c3dcae26840bad119c373e6c09
audited-base: d99781fb43c2b1c3dcae26840bad119c373e6c09
audited-head: 1bcf74d4f14a165cabaaa7e9cd1cc5faaa3311b1
implementation: 1bcf74d4f14a165cabaaa7e9cd1cc5faaa3311b1
head: 1bcf74d4f14a165cabaaa7e9cd1cc5faaa3311b1
reviewers: 4 read-only Sonnet subagents (correctness, security, ticket-fit, tests briefs)
harness: claude-code
session: 82329d0a-55d2-448f-aff5-0363cf80b32f
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Vet tests read the session cache, not the database
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:445-448
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:268
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:397
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:407
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:419
- source: tests reviewer
- severity: medium
- observation: VisitTest is @Transactional and only one test cleared the persistence context, so create/update/clear read back the cached entity. A broken vet_id mapping or a clear that never reached the row would still pass.
- fix: a flushAndClear() helper runs after every write the vet tests then assert on.

### Unknown vetId on edit and on owner-page booking untested
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:380
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:351
- source: tests reviewer
- severity: medium
- observation: Only POST /api/visits had an unknown-vet test; PUT /api/visits/{id} and POST /owners/{o}/pets/{p}/visits could regress to a 500 unnoticed.
- fix: one 404 test per path.

### Deleting a vet with visits is untested
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:429
- source: tests reviewer
- severity: medium
- observation: Keeping a deleted vet's visits rests on ON DELETE SET NULL in V4, and nothing exercised it; the delete could fail on the foreign key.
- fix: test deletes a vet through the API and reads the visit back with no vet.

### Chatbot list_visits omits the vet
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:126
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:155-158
- file: petclinic-backend/src/test/java/victor/training/petclinic/mcp/ListVisitsToolTest.java:81
- source: ticket-fit reviewer
- severity: low
- observation: The ticket says visits show their vet everywhere, yet the MCP list_visits answer had no vet field.
- fix: VisitView carries vetName, null when the visit has none.

## Ignored

### PUT without vetId clears the stored vet
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:85
- source: correctness, security, ticket-fit and tests reviewers
- severity: low
- observation: A client that omits vetId wipes the existing vet; "leave unchanged" cannot be told from "clear".
- why: PUT replaces the whole visit, so clearing persists, as ticket item 2 demands. See the assumption.

### Unknown vetId answers a bare 404, not a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VetRepository.java:20
- source: correctness, security and ticket-fit reviewers
- severity: low
- observation: A stale or bogus vetId fails the booking or edit with the generic "Not found!" 404, indistinguishable from a missing visit or pet.
- why: same as unknown pet types, OwnerRestController.java:150; a 400 belongs in a codebase-wide change.

### Vet ids can be enumerated via the 404
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VetRepository.java:20
- source: security reviewer
- severity: info
- observation: Probing vetIds on booking reveals which vets exist.
- why: GET /api/vets lists every vet already; nothing is disclosed.

### Visits expose vet names to every caller
- file: petclinic-backend/src/main/java/victor/training/petclinic/mapper/VisitMapper.java:51-53
- source: security reviewer
- severity: info
- observation: Visit DTOs now carry the vet's first and last name.
- why: Visit endpoints are OWNER_ADMIN-only and vet names are already public via /api/vets.

### Any existing vet can be attributed to a visit
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:192
- source: security reviewer
- severity: info
- observation: No check that the chosen vet may attend the visit.
- why: choosing any vet is the feature; the ticket sets no eligibility rule.

### Chatbot create_visit cannot choose a vet
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:55
- source: ticket-fit reviewer
- severity: low
- observation: Bookings made through the chatbot always have no vet.
- why: the vet is optional at booking; owners rarely know it. Separate ticket if wanted.

### Failed vets fetch shows "No vet" for a visit with one
- file: petclinic-frontend/src/app/visits/visit-edit/visit-edit.component.ts:43
- source: correctness reviewer
- severity: low
- observation: The error handler turns a failed GET /vets into [], so the combo finds no match and displays the placeholder.
- why: model keeps the old vetId, so saving does not clear it; display-only, error path.

### Clearing the combo could send '' or 0
- file: petclinic-frontend/src/app/design-system/combo.component.ts:57
- source: tests reviewer
- severity: info
- observation: The edit spec feeds onSubmit a hand-built null; if the combo emitted '' or 0 on clear, the old vet or a 404 would follow.
- why: pick('') sets null, line 57; covered by the combo's own spec.

### Pipe renders "null null" with vetId but no names
- file: petclinic-frontend/src/app/visits/visit-vet.pipe.ts:21
- source: tests reviewer
- severity: info
- observation: A visit with vetId set but names missing would print "null null".
- why: VisitMapper.java:51-53 sets id and both names together from one entity.

## Assumptions

### PUT replaces the visit; a missing vetId means no vet
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:85
- alternative: PATCH-like: absent keeps the vet, explicit null clears it
- confidence: 0.7
- why: Ticket item 2 makes "clear must stick" the priority, and full-replace PUT is the simplest rule that guarantees it; the only client, our edit form, always sends the field. Four reviewers flagged the omitted-field case, which pulls confidence down.

### Unknown vetId is a 404
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VetRepository.java:20
- alternative: 400 naming vetId as the bad field
- confidence: 0.6
- why: Matches how unknown pet types are handled. A 400 is more correct HTTP, which is why this is close to a coin flip.

### Deleting a vet keeps their visits, with no vet
- file: petclinic-backend/src/main/resources/db/migration/V4__visit_vet.sql:4
- alternative: refuse deleting a vet who has visits
- confidence: 0.6
- why: Ticket item 4 makes "no vet" a normal state, and before this change vet deletion always succeeded. Losing who attended is a real history loss, so a business owner could reasonably pick refusal.

### "No vet" is the wording for a visit without one
- file: petclinic-frontend/src/app/visits/visit-vet.pipe.ts:5
- alternative: "—" or "Not assigned"
- confidence: 0.75
- why: Ticket item 4 rules out "Unknown" and blank; "No vet" says "has none" literally, and the same label serves as the combo placeholder.

### Seed gives a vet to some demo visits only
- file: petclinic-backend/src/main/resources/db/seed/R__seed.sql:142-145
- alternative: leave every seeded visit without a vet
- confidence: 0.65
- why: The demo should show both states; ticket item 4 is about real legacy rows, not the demo dataset.

### MCP create_visit takes no vet; list_visits shows it
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:55
- alternative: also add a vet parameter to create_visit
- confidence: 0.7
- why: "Everywhere" in the ticket covers displaying, which list_visits does; choosing a vet at booking stays a staff action in the UI.
