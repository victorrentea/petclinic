# QA — Issue #25: Sorting & Pagination for the Owners Grid

Record of the design interview held **2026-08-13** between Victor and Claude, before any code was
written. Nothing in this document has been implemented yet.

> **Issue #25 — Add pagination to Owners grid**
> - The grid should be sortable by any column
> - The grid should be paginated in pages of 5, 10, or 20 rows per page

---

## 1. Starting point (established by reading the code, not by asking)

| | Today |
|---|---|
| Frontend | `owner-list.component.html` — a hand-written Bootstrap 3 `<table>` with `*ngFor`. No sorting, no paging. |
| Data loading | One `GET /api/owners?lastName=` fetches **every** owner at once. |
| Columns | Name (first + last in one cell), Address, City, Telephone, Pets (list of pet names). |
| Backend | `OwnerRestController.listOwners` returns `List<OwnerDto>`; `OwnerRepository extends Repository<Owner,Integer>` — no paging support. |
| Angular Material | Already wired up: `@angular/material` + `@angular/cdk` 16.2.1, the `indigo-pink` prebuilt theme imported in `styles.css`, `BrowserAnimationsModule` and `MatSnackBarModule` in `app.module.ts`. But **no grid components** — zero `mat-table` / `mat-paginator` / `mat-sort` anywhere. Adding a paginator is therefore low-friction: theme and animations already exist. |
| Payload weight | `OwnerDto` embeds `List<PetDto>`, and `PetDto` embeds `List<VisitDto>` — so listing owners serialises **owners → pets → visits**, three levels deep, for every row. |
| Pets mapping | `Owner.pets` is `@OneToMany(fetch = LAZY)`, a `Set<Pet>` — so the current list endpoint is an N+1 (1 query + 1 per owner, plus another level for visits). |
| Groundwork | `petclinic-frontend/src/app/owners/owner-page.ts` already declares an **unused** `OwnerPage { content, totalElements, totalPages, number, size }`. |
| Sample data | 28 owners. |

---

## 2. What the real data said

Read live from the `petclinic` database via the `postgres-db` MCP, at Victor's insistence — the
recommendation on which columns are worth sorting was **revised** as a result.

| Column | Distinct / 28 | Verdict |
|---|---|---|
| **Pets (count)** | 3 values: `0`, `1`, `2` | 2 owners have **zero** pets (James Bond, Hercule Poirot), 21 have one, 5 have two. |
| **Last name** | 26 | Useful. Two Potters (Harry, Beatrix), two Darlings (George, Wendy) — the first-name tiebreaker earns its keep. |
| **City** | 20 | The one good *grouping* sort — London holds 7 owners. |
| **Address** | 27 (≈ unique) | **Rejected.** `text` column, addresses lead with house numbers, so ascending yields `14 Kensington Gardens`, `221B Baker Street`, `26 Rue du Labrador`, `27 Outer Circle`, `30 Wellington Square`, **`4 Privet Drive`**, `62 West Wallaby Street`. "4" after "30" reads as a defect. |
| **Telephone** | 27 (≈ unique) | **Rejected.** `text`, unformatted, lengths 10–13. Sorting groups by dialling prefix. Nobody browses clients by phone number. |

Two further findings the seed file could not have revealed:

- **`telephone` is already NULL for Kevin McCallister**, though `V3__sample_data.sql` gives him a
  number. The DB drifted at runtime — someone blanked it through the UI. All five text columns are
  nullable, so empty values are a live concern, not hypothetical. (Mitigated by the fact that
  neither nullable-in-practice column ended up sortable.)
- **Database collation is `C`** (Postgres 16.2, UTF-8) — raw byte ordering. Demonstrated on
  realistic Romanian names:

  ```
  today (C):        Aaron | Oprea | Stan | Tudor | Zamfir | aaron | Öztürk | Ștefan | Țugui
  COLLATE ro-x-icu: aaron | Aaron | Oprea | Öztürk | Stan | Ștefan | Tudor | Țugui | Zamfir
  ```

  ICU collations **are** available in this Postgres (785 of them, including `ro-x-icu`).

---

## 3. Decisions

### 🧑‍💼 Functional

**Q1 — Whole list or just what's on screen?**
→ **Server-side sorting and pagination.** The business expects **10,000 owners within a few
months**, so fetch-all-and-slice-in-the-browser is off the table. *Recorded in `CLAUDE.md` under
"Expected Data Volumes" (commit `7549b160`).*

**Q2 / Q3 — Which columns are sortable?**
→ **Name, City, Pets only.** Address and Telephone stay plain, non-clickable headers — sorting them
produces output that reads as a bug or answers a question nobody asks. The issue's "any column" was
deliberately narrowed to the three that carry meaning.
- **Name** sorts by **last name, then first name**.
- **Pets** sorts by **count** — ascending starts with the zero-pet owners (Bond, Poirot). Agreed
  with Bizu.

**Q4 — First load, before anyone clicks anything**
→ **(a)** Default sort **Name ascending**. **(b)** Default page size **10**. **(c)** The grid lands
**populated** — page 1 of N — not empty-awaiting-a-search.

**Q5 — Ties**
→ **Every sort silently ends with: last name, first name, internal id.** Without this, slicing an
unordered block across pages makes the same owner appear twice while another never appears — the
normal behaviour of paging an unordered result set, and acute for Pets (only 3 distinct values, so
~3 giant blocks at 10k owners). The user never sees or configures the tiebreaker; ties simply read
alphabetically.

**Q6 — Search interaction**
→ Searching **resets to page 1**; the **sort survives** a search; the **page size survives** too.
Victor extended the rule: changing **page size** or **sort** *also* returns you to page 1 — "if I
sort, I want to see the first or last by that criterion, not stay on page 3."

> **Unified rule:** only the pager's own first/prev/next/last controls change which page you are on.
> Sort, page size and search always reset to page 1.

→ **Search semantics stay untouched** (starts-with, last name only). Widening it is a separate
issue, and would begin with another look at the real data.

**Q7 — Back button / shareable links**
→ **Page, size, sort and search live in the URL**, e.g. `/owners?lastName=Potter&page=3&size=20&sort=city,asc`.
Back returns you to where you were, F5 keeps your place, and links are shareable — Victor confirmed
the shareable part matters. *Consequence: these parameter names are now a public contract and cannot
be casually renamed.*

**Q8 — The pager itself**
→ **Standard Angular Material paginator**, below the table: `Items per page [10 ▾]`, `1 – 10 of
10,000`, first/prev/next/last. **No jump-to-page box.** The total count costs one extra `COUNT`
query per load — free at 10k, and the "of 2" feedback on a search is the most valuable number on
the screen.

**Q9 — The Pets column**
→ **Show the count alongside the names** (`2 — Dinah, Cheshire`; zero renders as a plain `0`).
Otherwise a user clicks *Pets* and the rows reorder by a quantity that is nowhere on screen — and
because ascending is first, page 1 would be a column of blank cells that looks like a loading
failure.
→ **Fix the malformed HTML** while we are in there: the cell currently opens a `<tr>` *inside* a
`<td>`, inside the row's own `<tr>`. Browsers paper over it; it will not be ported forward.

**Q10 — Empty states**
→ **Three distinct states**, because today they are conflated:
1. **Search found nothing** — *"No owners found with last name starting with 'Xyz'."*, search box stays filled.
2. **No owners at all** — *"No owners yet."* beside the Add Owner button.
3. **Request failed** — a clearly different error message.

> Today the message binds to `*ngIf="!owners"`, and an empty result is an empty *array*, which JS
> considers present. So an empty search renders a headers-only table with **no message**, while the
> "no owners named X" message appears only when the **backend is down**. Exactly backwards.

→ **Add Owner becomes always visible** — it currently sits inside the table block and disappears
with it, so on the "nothing found" screen there is no way to add the person you just failed to find.

**Q11 — Scope**
→ **Owners grid only.** Pets, Vets, Visits and Specialties keep their `*ngFor` tables for now. The
backend paging will be built so the other controllers can adopt it verbatim, but proving the design
on one grid comes before committing four.

### 🥷 Tester

**Q12 — Stale or hand-edited URLs** (they are user input now)
→ **`page` past the end** → return an **empty page** with a **link back to page 1** (not a 404 — a
bookmark simply aged).
→ **`size` outside 5/10/20** → **clamp** (`7`→10, `1000`→20). This is the guard that stops someone
pulling 10,000 rows by editing the address bar — a DoS guard, not tidiness.
→ **`sort` on a non-whitelisted column** → **400 Bad Request**. The sort parameter is a column name
that reaches the database; it must be validated against an explicit allowlist (`lastName`, `city`,
`petCount`) and never passed through. Silently ignoring it hides typos and invites a
property-name-injection shortcut later.

**Q13 — Concurrent edits shifting the list**
→ **Accepted, deliberately.** Offset paging means a colleague registering "Aaron Aaronson" while
you read page 5 shifts everything down one, so an owner can appear on both page 5 and page 6.
Cosmetic, small window, and the user's next action still works.
The correct fix — **keyset pagination** — is *mutually exclusive* with the paginator chosen in Q8:
it cannot jump to page N, cannot show "of 10,000", and cannot honour `?page=5` links.
→ **To be written into `CLAUDE.md` as known-and-accepted**, so nobody "fixes" it in six months.

**Q14 — Collation**
→ **Fix it inside this issue, with `ro-x-icu`**, via a Flyway migration:

```sql
ALTER TABLE owners ALTER COLUMN last_name  TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE text COLLATE "ro-x-icu";
```

Rationale: under `C`, every `Ș`/`Ț` surname sorts **after Z**, as does anyone typed in lowercase —
and Name-ascending is the *default* sort, so it is the first screen everyone sees. Pinning the
collation on the column means **no Java changes at all**: `Sort.by("lastName")` keeps working, and
dev/CI/prod stop disagreeing (collation is otherwise a property of whichever database instance you
happen to be talking to — a bug class that passes CI and fails in production).

Accepted costs, noted and not acted on: the migration rebuilds indexes on those columns, and under
a non-`C` collation a prefix search (`LIKE 'Dav%'`, used by Find Owner) needs a `text_pattern_ops`
index to stay index-backed. Imperceptible at 10,000 rows.

---

## 4. Blast radius — every consumer of `GET /api/owners`

Changing the response from a bare array to a page object breaks:

| File | Why |
|---|---|
| `petclinic-test/tests/owners.spec.ts` | `shows all owners on initial load` asserts **all 28** names are on screen — fails by design at page size 10. |
| `petclinic-test/tests/support/api-client.ts` | `fetchOwners()` typed `OwnerDto[]`, returns `response.data` directly. |
| `petclinic-backend/src/test/resources/features/functional/owners.feature` | Step *"the response JSON array has size 2"* asserts the body **is** an array. |
| `.../functional/OwnerSteps.java` | Parses the list response. |
| `.../perf/OwnerSearchThroughLatencyProxyTest.java` | Hits `get("/api/owners")`. Already flaky locally / green in CI. |
| `petclinic-frontend/.../owner.service.spec.ts`, `owner-list.component.spec.ts` | Stub `getOwners(): Observable<Owner[]>`. |
| `openapi.yaml` → `src/app/generated/api-types.ts` | Both regenerate. `owner-page.ts` hand-duplicates what the generator will produce. |

**Not affected:** `getOwners` / `searchOwners` are called from **owner-list only** — no other screen.
The chatbot and the MCP server use `/api/owners/{id}`, not the list.

---

## 5. Open — where the interview stopped

**Q15 (🥷, asked, not yet answered) — how deep the test net goes.** Proposed, pending Victor's
verdict on the E2E thickness:

- **Backend (TDD, the bulk of the value):** defaults (page 0, size 10, name asc); each sortable
  column both directions; the two-Potters tiebreaker; **pet-count ascending puts Bond and Poirot
  first**; unknown sort → 400; `size=1000` clamps; `page=99999` empty; **a Romanian-name fixture
  proving `Ștefan` sorts between `Stan` and `Tudor`** — the test that would have caught the
  collation bug.
- **Repairs** to the existing tests listed in §4.
- **Karma:** reset-to-page-1 on sort/size/search; URL parameters written and read back.
- **E2E (deliberately thin):** rewrite `shows all owners on initial load` → *shows the first 10,
  sorted by name*; plus **one** deep-link test (`?page=2&size=5&sort=city,asc` renders that exact
  view) to prove the shareable-link promise end to end. Skip per-column and per-page-size E2E — that
  is backend territory.
- **Aware, not acting:** `OwnerSearchThroughLatencyProxyTest` will pull 10 rows instead of 28, so
  its throughput baseline shifts.

CI runs a **SonarCloud Quality Gate** step that fails the build, and `CLAUDE.md` mandates TDD for
non-trivial code — so tests are not optional either way.

---

## 6. Questions not yet put to Victor — with the recommendation I would open with

These were identified but never asked. Each carries my recommended answer so the interview can
resume by confirming or overruling, rather than re-deriving.

### 🥷 Tester

**Q16 — Click Next three times quickly. Which response wins?**
Each click fires a request; responses can return out of order, so the grid can end up showing page 2
while the pager says 4. **This bug already exists** — `OwnersPage.ts` carries a comment describing
exactly it: *"Searching while that request is still in flight lets its response land last and
repaint the full list over the filtered one."* The E2E suite works around it with a wait.
→ **Recommendation: `switchMap` on the request stream**, so a new request cancels the previous one's
subscription and only the latest response can paint. It fixes the pre-existing search race for free.
Alternative — disable the pager while a request is in flight; simpler, but it makes fast paging feel
sticky and does nothing for the search race.

**Q17 — What does the user see while a page is loading?**
At 10,000 owners over a real network every page click is a round trip.
→ **Recommendation: keep the current rows on screen, dim them slightly, and disable the paginator
until the response lands.** Blanking the table on every click makes the grid flicker. No spinner —
at these latencies it would flash in and out and read as noise.
Alternative: a proper loading overlay, worth it only if the endpoint turns out slow.

**Q18 — Do the Playwright selectors survive?**
`OwnersPage.ts` hooks onto `#ownersTable` and `td.ownerFullName`.
→ **Recommendation: preserve both ids/classes verbatim**, whatever we do to the markup, and add
stable hooks (`data-testid`) for the new paginator and sort headers. Gratuitously renaming them
turns a behavioural change into a test rewrite and hides real regressions in the noise.

### 🧑‍💻 Technical

**Q19 — Change `GET /api/owners` in place, or add a second paginated endpoint?**
→ **Recommendation: change it in place.** Every consumer is ours (§4) — one Angular screen and our
own tests. The chatbot and MCP use `/api/owners/{id}` and are unaffected. A parallel
`/api/owners/paged` would mean two code paths, two OpenAPI entries, and a deprecated endpoint nobody
ever deletes. This is a private API; version it when it has external clients.
Alternative — keep the array response and add paging only when `page` is supplied. Backwards
compatible, but the response type then varies by query parameter, which OpenAPI models badly and
clients handle worse.

**Q20 — How does `petCount` become sortable, given it is not a column?**
→ **Recommendation: a derived property on the entity —**
`@Formula("(select count(*) from pets p where p.owner_id = id)") private int petCount;`
Then a **single** repository method `Page<Owner> findByLastNameStartingWith(String, Pageable)` serves
all three sorts, because Hibernate inlines the formula into `ORDER BY`. It also gives the count the
grid must display (Q9) with no extra plumbing.
Watch: this is a correlated subquery evaluated per row when sorting by it. At 10,000 rows expect
milliseconds; if it ever bites, fall back to a dedicated `@Query` with `LEFT JOIN … GROUP BY`, or a
denormalised `pet_count` column kept by trigger. **Measure before reaching for either.**

**Q21 — Pets per row without an N+1 — and without the paging trap**
A fetch-join plus `Pageable` makes Hibernate load the **entire** result set and paginate **in
memory** (`HHH000104`) — the exact opposite of what 10,000 owners need. So fetch-joining is out.
→ **Recommendation: `@BatchSize(size = 25)` on `Owner.pets`** — one extra query fetches the pets for
all 10 owners on the page instead of 10 queries. Note `PetDto` also drags in `visits`, so the same
treatment is needed one level down, or those visits should leave the list payload entirely (Q22).

**Q22 — Should the list response still carry pets-with-visits at all?**
The grid needs pet **names** and a **count**. It never shows visits. Today every listed owner
serialises its pets *and each pet's visits*.
→ **Recommendation: keep `OwnerDto` as-is for now, add `petCount`, and fix the N+1 with `@BatchSize`.**
Trimming visits out of the list payload is the right end state, but it is a second breaking change
layered onto the first, and this issue is already touching plenty. **Log it as a follow-up issue**
rather than smuggling it in.
Alternative — introduce a slim `OwnerListItemDto` (fields + `petCount` + pet names) now, while we
are breaking the shape anyway. Defensible; I would still split it, because it forces a decision
about `PetDto` reuse across four other endpoints.

**Q23 — Repository shape**
→ **Recommendation: leave `OwnerRepository extends Repository<Owner,Integer>`** — the deliberately
minimal interface — and add exactly `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)`.
Do **not** widen it to `JpaRepository`: that would expose `deleteAll`, `flush` and friends the
project has been careful not to publish. Spring Data derives the count query automatically.

**Q24 — Where is the sort allowlist enforced?**
Q12 requires a 400 for an unknown sort column, and the parameter is a property name reaching the
persistence layer.
→ **Recommendation: an explicit allowlist in the controller** — a small enum or `Map<String,String>`
mapping the three public names (`name`, `city`, `petCount`) to entity properties, rejecting anything
else with a 400 **before** a `Sort` object is ever built. Appending the tiebreaker (Q5) happens in
the same place, so the rule lives in one readable method.
Anti-pattern to avoid explicitly: accepting Spring's `Pageable` argument resolver as-is. It happily
builds a `Sort` from whatever the client sends, which is how an unvalidated property name reaches
the query.

**Q25 — Public sort parameter names**
Q7 made these a shareable-link contract.
→ **Recommendation: `sort=name,asc` / `city` / `petCount`**, i.e. *public* names decoupled from
entity fields. `name` maps to last-name-then-first-name (Q2), which no single entity property
expresses — so leaking `lastName` into URLs would misdescribe what it does and pin us to the current
mapping.

**Q26 — Bootstrap table or `mat-table`?**
→ **Recommendation: keep the existing Bootstrap 3 `<table>`; add `matSort` + `mat-sort-header` to
the three sortable `<th>` and a `<mat-paginator>` beneath it.** The Material theme and animations are
already imported, so this is a small import and no visual break with the rest of the app. It also
preserves the Playwright selectors (Q18) and the `routerLink` cells.
Alternative — a full `mat-table` rewrite. Cleaner Material idiom and better a11y out of the box, but
it restyles one screen in an app that is Bootstrap 3 everywhere else, rewrites the template wholesale
and breaks every selector. Not worth it for one grid; revisit if all five grids migrate (Q11).

**Q27 — `openapi.yaml` and the hand-written `owner-page.ts`**
→ **Recommendation: regenerate `openapi.yaml`, run `npm run generate:api`, then delete
`owner-page.ts`** and use the generated type. Keeping a hand-maintained mirror of a generated
contract is precisely how the two drift apart. Run `npm run lint:openapi` (Spectral) before pushing —
CI checks it.
Note: Spring's `Page` serialises with a warning in recent Boot versions and its JSON shape is not
stable API. **Prefer an explicit response DTO** with the four fields the frontend needs
(`content`, `totalElements`, `number`, `size`) so OpenAPI describes something real and the wire
format stops depending on Spring internals.

**Q28 — Guardrails and documentation**
→ **Recommendation:** record in `CLAUDE.md` (a) that page drift under concurrent inserts is
**known and accepted**, with the keyset trade-off spelled out, so nobody "fixes" it later, and
(b) the `ro-x-icu` collation decision and *why* the columns carry it rather than the database.
Both are conclusions no reader could recover from the code.

---

## 7. Status

**Nothing has been implemented.** The only changes made so far are documentation:
`CLAUDE.md` gained an "Expected Data Volumes" section and a task modifier requiring a look at real
data before advising on sorting, pagination or search (commit `7549b160`).
