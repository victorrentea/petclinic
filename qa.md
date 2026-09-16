# gh#25 — Interviu de design: paginare + sortare pe grid-ul Owners

Transcriere structurată a interviului de design purtat înainte de implementare. Fiecare întrebare
are recomandarea mea, decizia luată și motivul. Planul de execuție trăiește separat.

---

## Punctul de plecare

Issue #25 („Add pagination to Owners grid") cere:
- grid sortabil **după orice coloană**;
- paginare în pagini de **5, 10 sau 20** de rânduri.

Pe issue există un comentariu al unui contribuitor extern: *„Implemented: server-side pagination +
sorting via Spring Data Pageable, MatTable + MatPaginator + MatSort. All 130 backend tests pass."*

**Comentariul este neîntemeiat.** Verificat în cod: niciun `Pageable`/`PageRequest` în `src/main`,
niciun `MatTable`/`MatSort`/`MatPaginator` în frontend (Angular Material se folosește doar pentru
`MatSelect`, `MatDatepicker`, `MatSnackBar`), și niciun PR deschis care să referențieze issue-ul.
Singura urmă a unei încercări abandonate: `petclinic-frontend/src/app/owners/owner-page.ts` — o
interfață `OwnerPage` pe care **nu o importă nimic**.

---

## Q1 — Unde se face paginarea și sortarea?

**Opțiuni:** client-side · server-side pe endpoint-ul existent · endpoint nou paginat.

**Recomandarea mea inițială: client-side.** Argumentele erau: 28 de owneri în seed, „any column"
include coloana `Pets` (o colecție, greu de sortat în SQL), iar schimbarea formei răspunsului se
propagă în `openapi.yaml`, tipurile generate, E2E.

**Răspunsul lui Victor:** *„am avut un call cu Bizu, și mi-a spus că o să avem 100.000 de owneri
într-un an, în tabela aia."*

**Decizie: server-side.** Recomandarea mea a picat pe loc — se sprijinea pe volumul din seed, care nu
e volumul real. La 100k rânduri, „încarcă tot și filtrează în browser" nu e o optimizare prematură
evitată, e un bug.

> **Cerut explicit:** cifra de 100k să fie reținută în `AGENTS.md`, ca decizia să nu fie redescoperită
> de la zero la fiecare conversație.

**Ce a ieftinit decizia:** am verificat cine consumă lista azi. Doar frontend-ul și testele
(`OwnerTest`, `AddVisitSequenceTest`, `BasicAuthenticationConfigTest`,
`OwnerSearchThroughLatencyProxyTest`, cucumber `OwnerSteps`, glue-ul E2E, healthcheck-ul din
`start-apps.ts`). **Chatbot-ul și serverul MCP ating doar `/api/owners/{id}`** — deci schimbarea de
contract nu îi atinge.

---

## Q2 — Ce formă are contractul paginat?

**Opțiuni:** envelope pe endpoint-ul existent · array în body + metadate în headere (`X-Total-Count`,
`Link`) · endpoint nou, cel vechi rămâne.

**Decizie: A — envelope pe endpoint-ul existent.**
`GET /api/owners?lastName=&page=0&size=10&sort=lastName,asc` → `{content, totalElements, totalPages,
number, size}`.

- E exact forma interfeței orfane `owner-page.ts` — o scoatem din sertar în loc s-o ștergem.
- Printr-un **`PageDto<T>` propriu**, nu `Page`/`PageImpl` serializat direct: Spring Boot 3.3+
  avertizează explicit că JSON-ul lui `PageImpl` nu e contract stabil, iar `openapi.yaml` trebuie
  oricum să-l descrie explicit.
- Varianta cu headere ar fi păstrat compatibilitatea — dar nu aveam pe cine proteja, deci plăteam
  ergonomie degeaba.
- Endpoint nou ar fi lăsat în producție un `GET /api/owners` fără limită peste 100k rânduri — exact
  bomba de dezamorsat.

### Q2b — dezbaterea URL-ului (cerută explicit)

- **`page`/`size`/`sort`** sunt numele pe care `PageableHandlerMethodArgumentResolver` le leagă singur.
  Semnătura devine `listOwners(@RequestParam String lastName, Pageable pageable)`, zero parsing scris
  de mână. `sortBy`+`sortDir` ar fi însemnat parser propriu, testat de mine, fără multi-sort.
- **`sort=lastName,asc`**: ultimul token e direcția; multi-sort se face repetând parametrul
  (`sort=lastName,asc&sort=firstName,desc`), nu cu o listă în același param.
- **`page` rămâne 0-based.** Spring e 0-based, `MatPaginator.pageIndex` e 0-based. Se potrivesc, deci
  **nu** activăm `one-indexed-parameters`, care ar introduce o traducere off-by-one exact la granița
  unde nu-ți trebuie.

**Patru pericole identificate în URL-ul ăsta** (nimic nu era configurat în `application.properties`,
deci rulam pe default-urile Spring):
1. `size` la discreția clientului (default 20, max 2000) → `?size=2000` = zeci de MB.
2. `sort` la discreția clientului → `?sort=inexistent` dă 500, nu 400; `?sort=pets.name` deschide
   join-uri arbitrare peste 100k rânduri.
3. Paginare nedeterministă la valori egale (multe orașe „London") → același owner pe două pagini,
   altul pe niciuna.
4. `pets` în `OwnerDto`: paginare + `JOIN FETCH` pe colecție = `HHH000104` (Hibernate paginează în
   memorie); fără fetch = N+1.

---

## Q3 — Default și plafon pentru `size`

**Decizie: default 10, maxim 20.** Issue-ul enumeră 5/10/20; 10 e mijlocul. Default-ul Spring (20) ar
fi făcut prima încărcare cea mai scumpă dintre cele trei.

### Q3b — unde stă plafonul?

**Obiecția lui Victor** la recomandarea mea inițială: *„`spring.data.web.pageable.max-page-size=20`
pare setare globală. Sigur vrem pe toată aplicația?"*

Obiecție corectă, și mai gravă decât părea: proprietatea e nu doar globală, ci **trunchiază silențios
înainte ca cererea să ajungă în controller** — deci nici n-ai unde să întorci un 400.

**Decizie: plafon local, cu 400.**
- `@PageableDefault(size = 10, sort = "lastName")` pe parametru — default-ul e vizibil chiar la
  endpoint, nu într-un `.properties` la trei fișiere distanță.
- Gardă în controller: `size > 20` → **400**, prin `ExceptionControllerAdvice`-ul existent (care
  mapează deja `ConstraintViolationException` → 400). Un client care cere 5000 **află** că n-are voie,
  în loc să primească 20 și să creadă că aia e toată baza de date.
- Spring nu are adnotare de max-page-size per endpoint — resolver-ul e global prin construcție. Deci
  garda scrisă de mână nu reinventează nimic, e singura variantă locală.

*Verificat înainte de a recomanda:* nu există niciun alt `Pageable` în backend, deci global-ul n-ar fi
stricat nimic **azi** — dar rămâne action-at-a-distance.

---

## Q4 — Ce coloane sunt sortabile?

Prima mea formulare a întrebării a fost greșită, și Victor a prins-o:

> *„Tu te-ai uitat la ce vezi în ecran, în browser, în tabelul ăsta? Ia bagă tu un ochi și zi-mi după
> ce te uiți."*

Nu mă uitasem. Recomandam sortare după `lastName` pe baza schemei, nu a interfeței. **Ce am găsit
uitându-mă efectiv la pagină:**

1. **Coloana `Name` afișează „Kevin McCallister" — prenumele primul.** Sortarea după `lastName` ar fi
   produs o coloană care *arată nesortată* (Kevin, Harry, Erwin, Salazar…). Sortarea trebuie să fie pe
   ce vede omul, nu pe ce e în DB.
2. **`Telephone` e gol** la Kevin McCallister (NULL în seed) → ordonarea NULL-urilor devine o decizie.
3. **`Pets` are mai multe valori pe rând** (Roger Radcliff: Perdita + Pongo) — confirmă că nu e o
   coloană scalară.
4. **Bug de markup preexistent:** `tbody` are **60 `<tr>` pentru 28 de owneri**, fiindcă template-ul
   pune `<tr *ngFor="let pet of owner.pets">` **înăuntrul unui `<td>`**. HTML invalid. Cu `MatTable`
   (care își generează singur rândurile) nu supraviețuiește — deci reparatul intră în scope.
5. **`#ownersTable` și `td.ownerFullName` sunt contract de test** — glue-ul E2E se agață exact de ele.

Reformulat, întrebarea reală era: *ce înseamnă „sortează după Name"?*

**Recomandarea mea:** sparg `Name` în două coloane (`First name`, `Last name`), ca „any column" să
devină o promisiune care se poate ține.

**Decizia lui Victor: B — o singură coloană `Name`, afișată „McCallister, Kevin", sortată după
`lastName, firstName`.** Sortarea se vede corectă fără a lăți tabelul.

---

## Q5 — Semantica sortării la valorile-limită

**Decizie: `NULLS LAST` mereu, și pe ASC și pe DESC.**
Default-ul Postgres e „NULLS LAST pe ASC, NULLS FIRST pe DESC" — adică al doilea click pe `Telephone`
umple ecranul cu celule goale și pare că sortarea a stricat ceva. Costă un `Sort.NullHandling`
aplicat peste `Sort`-ul legat automat.

**Decise implicit, fără obiecție:**
- **Tiebreaker obligatoriu:** `id ASC` adăugat mereu la coada oricărei sortări. Nu e opțional, e
  corectitudine: fără el, la 100k rânduri cu valori egale, Postgres poate returna același owner pe
  două pagini și pe altul pe niciuna.
- **Collation:** se lasă colația bazei (`en_US.UTF-8`), deci sortarea rămâne sensibilă la
  majuscule/diacritice — consecventă cu search-ul după `lastName`, care e deja case-sensitive (testul
  E2E cere explicit ca „potter" să nu găsească nimic).

---

## Inspecția bazei de date

Făcută **înainte** de a recomanda orice index (regula: niciodată sugestii de schemă din memorie).

- `owners(id, first_name, last_name, address, city, telephone)` — toate coloanele text sunt nullable.
- **Singurul index existent este `owners_pkey`.** Nimic pe `last_name`.
- Colația bazei: **`en_US.UTF-8`** (non-C).

Consecința care contează: sub o colație non-C, un btree simplu pe `last_name` servește
`ORDER BY last_name`, dar **nu** servește `LIKE 'Pot%'` — pentru acela e nevoie de `text_pattern_ops`,
care la rândul lui nu servește `ORDER BY`. **Cele două nu se pot acoperi cu un singur index.**

---

## Decizii rămase deschise

| # | Subiect | Recomandare |
|---|---------|-------------|
| D1 | Coloane sortabile | Allowlist `{lastName, firstName, address, city, telephone}`; proprietate necunoscută → 400; `Pets` nesortabilă (abatere conștientă de la „any column") |
| D2 | Indexare | Un singur `owners(last_name, first_name, id)` pentru cazul dominant; `text_pattern_ops` doar dacă profilarea o cere; `city`/`address`/`telephone` rămân neindexate — costul real al lui „any column" la 100k |
| D3 | `totalElements` | Se acceptă `COUNT(*)` per cerere; alternativa `Slice` ar elimina totalul din paginator |
| D4 | Încărcarea `pets` | `@BatchSize` pe `Owner.pets` ⇒ o singură interogare suplimentară per pagină |
| D5 | Widget frontend | `MatTable` + `MatSort` + `MatPaginator` server-side, păstrând selectorii E2E |
| D6 | Search × paginare | Căutarea nouă resetează la pagina 0; sortarea se păstrează; fără deep-linking inițial |
| D7 | E2E | Scenariul `every owner in the clinic is listed` se rupe garantat (28 de owneri, pagină de 10) → rescris + scenariu nou de paginare |

---

## Reguli de proces stabilite pe parcurs

Ambele au fost cerute explicit pentru `AGENTS.md`:

1. **Volumul lui `owners`** ajunge la ~100.000 de rânduri într-un an. Listarea și căutarea de owneri se
   tratează ca dataset mare: paginare, sortare și filtrare în bază de date, niciodată în browser.
2. **Inspecția UI-ului se face prin accessibility snapshot** (modul implicit Playwright), **nu** prin
   screenshot-uri date apoi modelului spre parsare — imaginile ard tokeni degeaba. În interviul ăsta am
   încălcat regula: sesiunea Chrome era ocupată, iar eu am sărit la screenshot în loc să repar cauza.
