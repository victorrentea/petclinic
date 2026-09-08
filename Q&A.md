# Q&A — Issue #25, Add pagination to the Owners grid

A design interview held before writing any code. Every question below was answered by the
Product Owner or by the environment itself; the answers are the agreed design. No
implementation exists yet — this file is the brief the implementation must follow.

**Issue #25 asked for:** a grid sortable by *any* column, paginated 5 / 10 / 20 rows per page.
Two of those requirements did not survive contact with the real data. See Q2 and Q3.

## Starting point

| | State before this work |
|---|---|
| Endpoint | `GET /api/owners?lastName=` returns a plain `List<OwnerDto>` — the whole table |
| Repository | `OwnerRepository.findByLastNameStartingWith` returns `List`; no `Pageable` anywhere in the backend |
| Grid | `owner-list.component.html`, a hand-rolled Bootstrap 3 `<table>` with `*ngFor` |
| Material | Only `MatSnackBarModule` is imported; no `MatTable`/`MatPaginator`/`MatSort` in the project |
| Indexes on `owners` | Exactly one: `owners_pkey` |

An `owner-page.ts` file declaring an unused `OwnerPage` interface was found in the frontend.
Nothing imports it; it has been dead since the `rename projects: backend/frontend` commit.
It is a contract invented before a consumer existed — the exact mistake this document tries
not to repeat a second time.

---

## Q1 — Server-side or client-side pagination?

**Answer: server-side.**

The PO's target volumetry is **100,000 owners** in production. At that size the current
endpoint is not "slow", it is a denial of service against our own backend: it serialises the
entire table, every `OwnerDto` carrying its nested pets. Client-side paging is excluded by
definition — to sort in the browser you must first ship every row to the browser.

Recorded in `AGENTS.md` under **Domain Model → Volumetry**, because the seeded dev database
holds 28 owners and therefore hides this class of defect completely.

## Q2 — Which columns are actually sortable?

**Answer: only Name and City. Address and Telephone stay plain headers.**

The issue said "any column". Querying the real data showed that two columns are not worth an
index. Evidence, from the 28 seeded rows:

**`telephone` — 27 distinct values out of 28.** Near-unique, so sorting groups nothing. The
formats are mixed — `0119084455` next to `0442079460001`, `0032225112233`, `0039055290383` —
so a lexicographic sort orders by *dialing prefix*, which is not a thing anyone looks for.
One row (Kevin McCallister) has `telephone = NULL`, which would additionally force a
`NULLS FIRST/LAST` decision on a column nobody sorts.

**`address` — 27 distinct out of 28.** The real sorted output:

```
14 Kensington Gardens | 14 Kensington Gardens | 221B Baker Street | 26 Rue du Labrador |
27 Outer Circle | 30 Wellington Square | 4 Privet Drive | 62 West Wallaby Street |
671 Lincoln Boulevard | Admiral Benbow Inn | ...
```

`4 Privet Drive` lands *after* `30 Wellington Square`, because house numbers are text. Visible
garbage, not a theoretical objection.

**`city` — 20 distinct out of 28**, with London ×6 and Hogsmeade ×3. Low cardinality, so
sorting genuinely groups. Worth an index.

Two indexes instead of five, and three fewer to maintain on every insert into a 100k table.

Also agreed: an explicit **whitelist** of sortable properties, because a `Sort` taken straight
from a query parameter becomes an `ORDER BY` on any JPA property — including navigation into
`pets`. That is both an attack surface and a source of 500s. And a **stable tie-breaker**
(`, id ASC`), because without one Postgres may return the same owner on two different pages:
`Potter` appears twice and `Darling` appears twice in the seed data already.

## Q3 — The Name column

**Answer: one sortable criterion, rendered last-name-first.**

The grid has no first-name and last-name columns — it has a single `Name` cell rendering
`{{firstName}} {{lastName}}`. So it is *one* sort criterion mapping to
`ORDER BY last_name, first_name`, not two.

The PO was asked whether the display could be flipped to "Rentea Victor" and did not object.
Flipping it is also the technically correct choice: a header that displays "Victor Rentea"
but sorts by `last_name` looks, when clicked, like it sorts at random — by the second word.
Rendering `{{lastName}} {{firstName}}` makes the ordering self-evident.

## Q4 — The `C` collation

**Answer: ICU collation per column, in a new Flyway `V4__` migration. `owners` only.**

The database was created with `datcollate = C`, so text sorts by UTF-8 bytes. The real sorted
last names end:

```
... | Silver | Tremaine | Weasley | Wensleydale | Śliwiński
```

**Śliwiński sorts after W.** With 100,000 European owners that is a business-reported bug.

The database collation itself cannot be changed — there is no `ALTER DATABASE ... SET COLLATE`;
it is frozen at `initdb`. Changing it means a new database, `pg_dump`/`pg_restore`, downtime
and ops involvement. That is a genuine infrastructure migration and is **not** what we are
doing.

We do not need it. Collation can be set **per column**, which is ordinary DDL. Verified
against the dev database inside a transaction that was then rolled back:

```sql
ALTER TABLE owners ALTER COLUMN last_name  TYPE varchar(30) COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE varchar(30) COLLATE "und-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE varchar(80) COLLATE "und-x-icu";
```

After that, a **plain `ORDER BY last_name` with no `COLLATE` clause in the query** returns
`... | Silver | Śliwiński | Tremaine | Weasley | Wensleydale`. Correct.

That is why this beats putting `COLLATE` in the queries: Spring Data's standard `Sort` keeps
working unmodified, with no native `@Query`. And indexes created *after* these `ALTER`s
inherit the column collation, so `ORDER BY` can actually use them — otherwise we would be back
to a full scan on every header click.

Environment checked: **PostgreSQL 16.2**, `und-x-icu` present (`collprovider = 'i'`). Nothing
to install.

**The honest cost:** `ALTER COLUMN TYPE` rewrites the table and takes an `ACCESS EXCLUSIVE`
lock. Instant on 28 rows, seconds on 100k — but it is an exclusive lock, so in production it
runs in a deploy window. That is the one precaution.

`vets` has the same latent problem but is out of scope for #25: no 100k volumetry, no sorting
requested. To be fixed when pagination is asked for there.

## Q5 — The response shape

**Answer: a hand-written `OwnerPageDto {content, totalElements, totalPages, number, size}`.**

Returning Spring's `Page<OwnerDto>` raw was rejected. On Spring Boot 3.5.11, serialising
`PageImpl` as-is is explicitly warned against and is not a stable contract; springdoc would
also emit a `PageOwnerDto` schema carrying `pageable`, `sort.sorted/unsorted/empty`, `first`,
`last`, `numberOfElements`, `empty` — roughly twenty junk fields — into `openapi.yaml`, a file
that is under CODEOWNERS and linted by Spectral.

Returning an array plus an `X-Total-Count` header was also rejected: headers do not reach the
generated TypeScript types, so the frontend would read them alongside the contract rather than
through it.

## Q6 — What the grid sends for the Pets column

**Answer: a slim `OwnerListItemDto` carrying only pet names.**

Checking the mappings surfaced the real reason the endpoint cannot survive 100k:

- `Owner.pets` — `@OneToMany(fetch = LAZY)`
- `Pet.visits` — `@OneToMany(fetch = LAZY)`
- `Pet.type` — `@ManyToOne`, EAGER by default
- and the DTO serialises the whole chain: `OwnerDto` → `List<PetDto>` → `List<VisitDto>`

A page of 20 owners costs one query for the page, twenty for `pets`, one per pet for `visits`,
plus one per pet for `type`. **A two-level N+1.** The endpoint is not expensive because of
JSON size, it is expensive because of a thousand queries per call — and **pagination alone does
not fix this**, it only reduces N from 100,000 to 20.

The grid renders literally `{{pet.name}}` and nothing else, so `visits` and `type` are shipped
today and never displayed. `@BatchSize` was the considered alternative and would have been the
cheap safety net; the slim DTO was chosen instead because it stops sending data no one reads.

## Q7 — Where the pagination markup lives

**Answer: inline in `owner-list.component.html` for now; extract to the design system at the
second consumer.**

`MatTable` was ruled out by the repository's own rules rather than by taste. The design system
contains only `ComboComponent`, and `AGENTS.md` states that every single-select in a form goes
through `<app-combo>` — *"a raw `<select>` in a form template is a bug, not a shortcut"*. The
"5 / 10 / 20 rows per page" selector **is** a single-select, so it goes through `<app-combo>`,
not through a hand-written `<select>` and not through `MatPaginator`, which brings its own
`mat-select` and bypasses the design system entirely. Adopting `MatTable` for one screen would
introduce a second UI vocabulary, which is what `AGENTS.md` exists to prevent.

`vet-list`, `visits-page` and the pets grid exist but none has pagination requested and none
has 100k volumetry. A design-system widget designed from a single use case freezes the wrong
API — `owner-page.ts` is the proof sitting in the tree.

## Remaining decisions, taken on the recommendations

The PO delegated the rest. These are the recommended answers, now binding:

- **Search composes with paging.** `?lastName=` stays on the same endpoint and combines with
  `page`, `size` and `sort`; it does not get an endpoint of its own. Changing the search term
  resets to page 0 — otherwise a narrower result leaves the user stranded on an empty page.
- **Defaults:** page size **5**, sort **`lastName` ascending**. Five is the smallest size the
  issue offers and makes the pagination visibly work against the 28-row dev dataset.
- **Page, size and sort live in the URL query parameters**, so a page is bookmarkable and the
  browser Back button steps through it.
- **`owner-page.ts` is deleted, not revived.** It happens to declare the same five fields we
  chose, which is reassuring about the shape but is not a reason to trust dead code. A fresh
  type is generated from `openapi.yaml`.
- **TDD order:** the backend controller slice test first (paging, sorting, whitelist rejection,
  tie-breaker stability), then the migration, then the frontend, then one `petclinic-test` e2e
  scenario for paging.
- **`owners.feature` changes on purpose.** The scenario at lines 14-17 asserts *"the response
  JSON array has size 2"* and breaks when the response becomes an object. It is rewritten to
  assert on `content` — an accepted contract change, not a test bent to go green.

## Questions the environment answered, so they were never asked

- **`openapi.yaml` is not hand-edited.** `OpenApiExtractorTest` regenerates it from the running
  app's API docs and CI fails on drift; `api-types.ts` is regenerated from it in pre-commit via
  `npm run generate:api`. The contract follows the code automatically.
- **`db/migration/` is under CODEOWNERS**, so the `V4__` migration requires review from
  `@victorrentea/elders`. Not blocking, but the PR will not self-merge.

## Blast radius of the contract change

- Frontend: `owner-list.component.ts` only, plus two spec files, through
  `OwnerService.getOwners` / `searchOwners`.
- Backend: one Cucumber scenario, `owners.feature:14-17`.
- No MCP or chatbot consumer touches `listOwners`.
