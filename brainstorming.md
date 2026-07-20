# Brainstorming — Issue #25: Add pagination to Owners grid

> Sumar al interviului de design. Deciziile **confirmate de tine** + cele **rezolvate cu recomandările implicite** (fiindcă ai plecat la curs). Reluăm de la secțiunea "Next steps" după pauză.
>
> Issue: *"The grid should be sortable by any column; paginated in pages of 5, 10, or 20 rows."*

---

## 0. Starea actuală (fapte verificate în cod/DB)

- **Backend** `GET /api/owners?lastName=` → întoarce `List<OwnerDto>` (tot array-ul, fără paginare). Are deja `/count`. Zero `Pageable` în cod.
- **Frontend** `owner-list` = tabel **Bootstrap 3** (`table table-striped`), fără sort/paginare. Coloane: Name (firstName+lastName, link), Address, City, Telephone, Pets.
- **Angular Material 16.2.1** e deja dependință, dar **nefolosit** pentru tabele.
- Frontend are **tipuri generate** din OpenAPI: `src/app/generated/api-types.ts` (nu se editează de mână — se regenerează).
- Schema DB deținută de **Flyway** (`V1..V8`, `ddl-auto=none`). Tabela `owners`: coloane `text` nullable; **singurul index = PK pe `id`**. Colația bazei = **`C`**.
- Date reale: **28 owneri**. Producție planificată: **mii de owneri în câteva luni** (→ regulă nouă în `CLAUDE.md`).
- Comentariul de pe issue ("Implemented…") e de la un participant (`ariazevedopt`) pe branch-ul lui — **nu există PR de reutilizat**; implementăm fresh pe `orange07`.

---

## 1. Decizii CONFIRMATE de tine

| # | Întrebare | Răspunsul tău |
|---|-----------|---------------|
| Q1 | Paginare/sort client-side vs **server-side**? | **Server-side (Spring Data Pageable)** — justificat de "mii de owneri în producție". |
| Q2-bis | Ce coloane rămân sortabile? (după inspecția datelor) | **Doar Name + City.** Address, Telephone, Pets = nesortabile. |
| Q3 | Cheia de sort pe coloana "Name" + afișare | **Inversăm afișarea → `lastName firstName`** (UI-ul era greșit, confirmat cu Bizu). Sort = **lastName, apoi firstName**. |
| Q4 | Soarta căutării "Find Owner by last name" | **Păstrată ca filtru server-side**, compus cu page/size/sort. |
| Q5 | Randare grilă | **mat-table + matSort + mat-paginator**, stilizat să arate ca Bootstrap. |
| Q6 | Page size default (opțiuni 5/10/20) | **10** |
| Q7 | Sort implicit la încărcare | **Name ascendent** |
| Q8 | Stare listă în URL (query params) | **Da** — page/size/sort/lastName în URL = sursa de adevăr. |
| Q9 | Endpoint in-place vs nou | **In-place** — un singur `GET /api/owners`, mereu paginat. |
| Q10 | Forma răspunsului paginat | **PageDto custom slim** `{ content, totalElements, page, size, totalPages }`. |

### De ce Name + City și nu "any column" (dovezi din cele 28 de rânduri)
- **Telephone**: 1 NULL (Kevin McCallister), 27 distincte, lungimi 10–13, prefixe internaționale amestecate (UK `044…`, BE `0032…`, IT `0039…`, ES `0034…`) → sort pe string = ordine inutilă.
- **Address**: 27/28 **unice**, free-form, multe încep cu numărul casei (`14`, `221B`, `671`) → sortarea nu grupează nimic.
- **City**: 20 distincte cu repetiții reale (**London ×6**, **Hogsmeade ×3**) → grupare cu sens. ✔

---

## 2. Decizii rezolvate cu RECOMANDĂRILE mele implicite (de reconfirmat)

| # | Temă | Decizie implicită (default) |
|---|------|------------------------------|
| D11 | **Indecși DB** (scală mii) | Migrație Flyway nouă **`V9__add_owners_search_indexes.sql`**:<br>`CREATE INDEX idx_owners_last_name_first_name ON owners (last_name, first_name);` — servește sortul default (last,first) **și** filtrul prefix `LIKE 'x%'` (colație `C` → btree simplu e folosibil).<br>`CREATE INDEX idx_owners_city ON owners (city);` — servește sortul pe city.<br>*La 28 de rânduri e no-op, dar corect pentru scala anunțată. NU ca `@Index` JPA (Flyway deține schema).* |
| D12 | **Format afișare Name** | `"Franklin, George"` (cu virgulă) — format standard de nume sortabil. |
| D13 | **Maparea sortului matSort → Spring** | col `name` → `sort=last_name,{dir}&sort=first_name,{dir}`; col `city` → `sort=city,{dir}`. Backend cu **whitelist** de proprietăți sortabile (`last_name,first_name,city`) — respinge restul (evită sort arbitrar / 500). |
| D14 | **Backend** | `OwnerRepository.findByLastNameStartingWith(String, Pageable): Page<Owner>`; controller mapează `Page<Owner>` → `OwnerPageDto` (DTO concret, nu generic Java → OpenAPI/type-gen curate). `@PreAuthorize` neschimbat. Reset la `page=0` la căutare nouă. |
| D15 | **Frontend** | MatPaginator `pageSizeOptions=[5,10,20]`, `pageSize=10`, `length=totalElements`. `matSortActive="name"`, `matSortDirection="asc"`. Doar Name+City au `mat-sort-header`. `(sortChange)`/`(page)`/search → `Router.navigate` cu queryParams merged; `ActivatedRoute.queryParams` = sursa → un singur `load()` care construiește requestul. |
| D16 | **Stilizare (frontend-ux)** | Header bg/border + bold ca tabelele Bootstrap surori; zebra pe rânduri impare; borders per-celulă; **`table-layout: fixed` + lățimi explicite per coloană** (obligatoriu la tabel sortabil, altfel coloanele sar la toggle sort); reuse `.btn-default` pt "Add Owner"; `white-space: nowrap` pe butoane/label-uri. Target CSS: `.mat-mdc-header-cell`, `.mat-mdc-cell`, `tr.mat-mdc-row:nth-child(odd)`, `.mat-column-<name>`. |
| D17 | **Fix bug existent** | HTML-ul actual are `<tr>` imbricat în `<td>` pt Pets (invalid). Îl reparăm la migrare: Pets = nume separate prin virgulă. |
| D18 | **Scope** | Doar grila **Owners** (nu Vets/Pets) în acest issue. |

---

## 3. Blast radius — fișiere de atins (schimbarea formei API e breaking)

**Backend**
- `rest/OwnerRestController.java` (listOwners → Pageable + OwnerPageDto)
- `rest/dto/OwnerPageDto.java` (nou)
- `repository/OwnerRepository.java` (semnătură Pageable)
- `resources/db/migration/V9__add_owners_search_indexes.sql` (nou)
- Teste: `rest/OwnerTest`, functional `owners.feature` + `OwnerSteps`, perf `OwnerSearchThroughLatencyProxyTest` + jmeter, `security/BasicAuthenticationConfigTest`
- `guardrail/OpenApiExtractorTest` → regenerează `openapi.yaml` (root)

**Frontend**
- `owners/owner-list/owner-list.component.ts` + `.html` + `.css`
- `owners/owner.service.ts` (params page/size/sort/lastName; tip PageDto)
- `owners/owners.module.ts` (MatTable/MatPaginator/MatSort modules)
- `generated/api-types.ts` → **regenerat din spec** (nu editat manual)
- Teste: `owner-list.component.spec`, `owner.service.spec`

**Alte repo-uri**
- `petclinic-chatbot` `AssistantFlowTest` (stub pe forma array → actualizat)
- `petclinic-ui-test` (Playwright): `tests/pages/OwnersPage.ts`, `tests/support/api-client.ts`

**Neafectat**: MCP (`PetClinicMcp`) folosește `OwnerRepository` direct, nu endpoint-ul REST.

---

## 4. Next steps (când reiei)

1. **Reconfirmă** secțiunea 2 (defaults) — mai ales D11 (indecși) și D16 (lățimi coloane).
2. TDD backend: test paginare/sort/filtru + whitelist → `OwnerPageDto` + controller + repo + `V9`.
3. Regenerează `openapi.yaml` (OpenApiExtractorTest) → regenerează `api-types.ts`.
4. Frontend: migrare mat-table + wiring URL-state + CSS de consistență.
5. Actualizează testele rupte (backend, chatbot, Playwright).
6. Rulează toată suita (CLAUDE.md: "always run tests").

## 5. Note / loose ends
- `CLAUDE.md` are deja regula nouă **`## Scale & Data Volume`** (necommis-ă încă).
- Căutarea pe lastName rămâne **case-sensitive** (`startingWith`) — out of scope; de reconsiderat separat.
- Lățimile exacte per coloană (D16) cer o trecere vizuală rapidă.
- Atenție: **sesiune Claude concurentă** activă în folder (are modificări necommis-e pe `petclinic-backend/CLAUDE.md`, `OpenApiExtractorTest.java`, `multi-review/SKILL.md`).
