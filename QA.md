# GH #25 — Paginated, sortable Owners grid: design Q&A

Issue: *sortable by any column; pages of 5, 10 or 20 rows.* Branch `mm26sep`.
All answers below are decided by Victor.

| # | Question | Answer |
|---|---|---|
| 1 | Start from `blip26` (already implemented there) or from scratch? | From scratch on `mm26sep`. `blip26` stays as the answer key. |
| 2 | How many owners must the grid handle? | ~50k within a year (the client's plan) → paginate, sort and filter **server-side**. Recorded in `AGENTS.md`. |
| 3 | Which columns sort? | Only **Name** and **City**, pushing back on "any column". From the data: addresses start with house numbers or have none (`"110" < "27"`), phones mix international prefixes with local numbers, Pets is a list. |
| 4 | Name sorts by…? | `last_name, first_name`, as in a school register (Romanian tradition). The display flips to match: **"McCallister, Kevin"**, since sorting by the second word of "Kevin McCallister" would confuse everyone. |
| 5 | Where does "Last, First" apply? | **Everywhere an owner's name is shown**, through one `ownerName` pipe: Owners grid, owner record, Visits list, Add/Edit Pet, Add/Edit Visit. Vets stay "First Last". |
| 6 | Same `GET /api/owners` or a new endpoint? | Same endpoint, **always paginated** — no full list by default. Checked first: only the Frontend calls it (chatbot and MCP clients use other endpoints). |
| 7 | Page shape in JSON | Hand-written `OwnerPageDto { content: OwnerDto[], totalElements }` in `rest/dto/`. The unused `owners/owner-page.ts` goes; the frontend uses the generated type. |

## Done along the way
- `AGENTS.md`: *"The client plans ~50k owners by Sep 2027: page, sort and filter them in the DB, on indexed columns."*
- `petclinic-backend/docs/Deployment.drawio.png`: added the **Chatbot** (:8082, calls the backend's REST feed + MCP) and an external **AI agent** (MCP client), arrows `traced="no"`. `DeploymentDiagramTest` passes. Layout to be tidied by hand.

## Still to decide
Sort request format and tie-breakers · initial sort and page size · search box + paging interplay ·
indexes (Flyway V4 clash with the dev DB) · pets per row (N+1) · grid state in the URL · frontend
widgets (`matSort` / `mat-paginator` vs. design system) · page past the end and bad params ·
acceptance `.feature` · migrating the callers that read the full list.
