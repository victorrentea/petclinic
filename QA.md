# QA — Issue #25: paginare + sortare pe grila de Owners

Interviu de design, 31 aug 2026. Partea I = ce ai decis deja. Partea II = ce a mai rămas,
fiecare cu răspunsul pe care îl recomand — dacă le lași așa, le implementez așa.

---

## Context care a schimbat totul

**Volumetria: ~100.000 de owneri în 1–5 ani** (declarat de tine, notat și în `AGENTS.md`).
Azi baza are 28. Numărul de azi nu contează la nimic în deciziile de mai jos.

**Diagrama de deployment e adevărul.** Extras din metadatele XML embedate în
`petclinic-backend/docs/deployment.drawio.png` (chunk `zTXt`/`mxGraphModel`, deflate +
URL-decode — nu OCR):

| de la | la | etichetă | `traced` |
|---|---|---|---|
| Pet Owner | Frontend `Browser` | uses | no |
| Veterinarian | Frontend `Browser` | uses | no |
| **Frontend** `Browser` | **Backend** | REST · HTTPS/JSON | **yes** |
| Backend | Database `DB` | JPA · SQL | yes |

Singura săgeată care intră în Backend vine din Frontend. Chatbot-ul (:8082) nu e pe
diagramă → nu e în producție → nu e client de menajat.

**Ce am găsit în baza reală** (prin MCP-ul de Postgres, 28 owneri):

- pets/owner = 0, 1 sau 2. Douăzeci de owneri au exact 1.
- `owners` **n-are niciun index în afară de `owners_pkey`**. Toate cele 4 coloane text sunt nullable.
- 20 orașe distincte / 28 owneri; London ×7, Hogsmeade ×3.
- 27 adrese distincte / 28 owneri.
- Un owner fără telefon (`NULL`), doi owneri fără pets.
- Colația bazei: `en_US.UTF-8`, Postgres 16.2.

**Dovada că ties-urile rup paginarea.** Aceeași sortare `ORDER BY city`, două planuri,
pozițiile 6–10:

| plan | id-uri |
|---|---|
| `LIMIT 5 OFFSET 5` (top-N heapsort) | `20,21,22,24,17` |
| `row_number() OVER (ORDER BY city)` (sort complet) | `20,`**`22,21`**`,24,17` |

Pe 28 de rânduri e doar o inversiune. Pe 100k rânduri sintetice cu aceleași ties, cele două
planuri întorc **mulțimi complet disjuncte** (`60,100,40,80,200` vs
`31840,16380,27020,26440,51500`) — adică un owner poate lipsi din toate paginile sau apărea
pe două. De aici: **orice sortare are `id` ca departajare finală.**

---

## Partea I — decis

| # | Întrebare | Decizia ta |
|---|---|---|
| 1 | Paginare server-side sau client-side? | **Server-side.** La 100k, client-side nici nu se pune. |
| 2 | Ce fac cu `GET /api/owners` care întoarce tot? | **Îl schimb, breaking, fără variantă de compatibilitate.** Un singur client (SPA-ul), livrat în același release. |
| 3 | Cum arată grila în UI? | **Păstrez tabelul Bootstrap** (`#ownersTable`, `td.ownerFullName` — selectorii din `owner-search.glue.ts` supraviețuiesc) și adaug `matSort` pe `<th>` + `<mat-paginator>`. Material e deja în proiect, deci fără dependență nouă. |
| 4 | Ce coloane sunt sortabile? | **Doar Name și City.** Address sortată lexicografic pune „4 Privet Drive" după „30 Wellington Square" și are 27 valori distincte din 28 — nu ordonează nimic. Telephone sortează accidental după prefixul de țară. Pets are 3 valori posibile. Contrazice literal „sortable by any column" din issue — asumat. |
| 5 | Indecși? | **Toți 3**, într-o migrare Flyway: `(last_name, first_name)`, `(city)`, plus `(last_name text_pattern_ops)` pentru `LIKE 'Pot%'` — cu colația `en_US.UTF-8`, btree-ul obișnuit nu e folosit de prefix search, iar cel cu `text_pattern_ops` nu poate servi `ORDER BY`. |
| 6 | N+1 pe coloana Pets? | **`@BatchSize` pe `Owner.pets`.** `JOIN FETCH`+`Pageable` e capcană: Hibernate aduce toate rândurile în memorie (`HHH90003004`). |
| 7 | Forma payload-ului paginat? | **`PagedModel<OwnerDto>`** din Spring Data. JSON: `{content, page:{size,number,totalElements,totalPages}}`. |
| 8 | Unde trăiește starea grilei? | **În query params pe rută:** `/owners?page=2&size=10&sort=city,asc&lastName=Pot`. |

---

## Partea II — rămase, cu răspunsul meu

### 9. Ce dimensiune de pagină e implicită?

**Recomand: 10.** Issue-ul cere 5/10/20; 10 e mijlocul și umple ecranul fără scroll la
1280×800 (rezoluția la care rulează Playwright). Opțiunile paginatorului: `[5, 10, 20]`,
exact ca în issue, fără „All" — la 100k, „All" e un DoS pe propriul backend.

### 10. Ce sortare e implicită?

**Recomand: `lastName,asc` (apoi `firstName`, apoi `id`).** Azi grila n-are `ORDER BY`
deloc și iese în ordinea fizică ≈ `id`, care nu e o garanție. Alfabetic după nume e cum
caută un om o persoană, și e exact indexul pe care oricum îl adăugăm.

### 11. Backendul acceptă orice `?sort=`?

**Recomand: whitelist strictă, altfel `400`.** Doar `lastName`, `firstName`, `city`.
Spring Data acceptă implicit orice cale de proprietate JPA — inclusiv `pets.visits.description`
sau coloane fără index, adică scan pe 100k rânduri la cererea oricui. Același tratament
pentru `size`: doar `5|10|20` (`400` în rest), ca să nu ceară cineva `size=100000`.

### 12. `Page` face un `COUNT(*)` la fiecare cerere. Problemă la 100k?

**Recomand: îl păstrăm.** Paginatorul Material are nevoie de `totalElements` ca să știe câte
pagini să deseneze, iar un `COUNT(*)` pe 100k rânduri e ~10–20 ms — acceptabil. Alternativa
(`Slice`, doar „mai există pagină următoare") schimbă UI-ul în „next/prev" fără număr total,
ceea ce nu e ce cere issue-ul. **Dacă devine problemă**, e o optimizare ulterioară, nu o
decizie de acum.

### 13. Căutarea după `lastName` resetează pagina?

**Recomand: da, la `page=0`, cu sortarea păstrată.** Altfel cauți „Pot", ești pe pagina 5,
și vezi o grilă goală cu paginatorul spunând „51–60 din 2".

### 14. Scenariul „every owner in the clinic is listed" din `owner-search.feature` se rupe.

**Recomand: îl rescriu, nu-l șterg.** Devine „the first page of owners is listed", care
verifică că grila arată primii 10 owneri sortați și că paginatorul raportează totalul.
Scenariul acoperă azi și `@generate_sequence` (produce `owner-search.feature.genseq.puml`) —
dacă îl șterg, pierdem diagrama și `DeploymentDiagramTest` rămâne fără arcul
`Browser -> Backend` pe care îl verifică.

### 15. Unde scriu testele noi de paginare/sortare?

**Recomand: Gherkin, în `owner-search.feature`** (redenumit conceptual „owners grid"), cu
glue-ul existent extins. Motivul: paginarea și căutarea se ating direct (vezi #13) și
`owner-search.glue.ts` are deja `expectOwnersListed`. Scenarii: pagina implicită, schimbarea
mărimii, navigarea la pagina 2, sortarea pe Name, sortarea pe City, căutare + paginare
împreună. **Interdicția din `petclinic-test/AGENTS.md` rămâne respectată**: niciun scenariu
nu creează sau șterge owneri.

### 16. Teste de backend, în TDD?

**Recomand: da, întâi roșu.** `OwnerRestControllerTest` (sau echivalentul existent):
pagina implicită are 10 elemente și `totalElements` corect; `?sort=city,asc` e stabil peste
pagini (exact bug-ul dovedit mai sus — două pagini consecutive nu au niciun id comun);
`?sort=address` întoarce 400; `?size=100000` întoarce 400. Plus un test care numără
interogările pentru `@BatchSize` (2, nu 21) — repo-ul are deja instrumentarul de trace.

### 17. Ce fac cu `petclinic-frontend/src/app/owners/owner-page.ts`?

**Recomand: îl șterg.** E o interfață scrisă de mână, nefolosită de nimeni, și forma ei
(`{content, totalElements, totalPages, number, size}`) nu mai e cea aleasă la #7. Tipul
paginii se derivă din `src/app/generated/api-types.ts`, exact cum face `owner.ts`.

### 18. Ceilalți consumatori ai lui `GET /api/owners` din repo?

**Recomand: îi repar în același commit.** Toți fac `data.map` pe un array și vor primi un
obiect:
- `petclinic-test/src/owner-search.glue.ts` (pasul `the clinic has these owners`)
- `petclinic-test/src/visit-date-validation.dsl.ts` (`aPetWithAKnownBirthDateExists`)
- scripturile de film din scratchpad (`bug-before.js`, `bug-after.js`)

### 19. Artefacte regenerate + review

**Recomand: le regenerez eu, progresiv, înainte de push** (ca să nu curăț după auto-commit-ul
din CI): `openapi.yaml` (`OpenApiExtractorTest`), `api-types.ts` (`npm run generate:api`),
`petclinic-backend/DB.sql` (`DbSchemaExtractorTest`), `docs/generated/DB.puml`,
`owner-search.feature.genseq.puml/.json` (rerulez `./run-tests-with-tracing.sh`).
**Atenție:** `openapi.yaml` și `db/migration/` sunt în CODEOWNERS → cer review de la
`@victorrentea/elders`. Ăsta e PR-ul care are nevoie de un om.

### 20. Ce fac cu lucrul necommitat din issue #40 aflat acum în arbore?

**Recomand: îl commitezi separat, întâi.** Branch-ul `adobe26_2` are 6 fișiere modificate +
2 fișiere de test noi de la #40 (validarea datei vizitei), plus modificarea mea de acum în
`AGENTS.md` (volumetria). Amestecate cu #25 devin un PR imposibil de citit. Ordinea propusă:
commit #40 → commit volumetria în `AGENTS.md` → abia apoi încep #25.

---

## Ce NU intră în acest issue

- Indexarea pentru căutarea fuzzy / `ILIKE` / `pg_trgm` — altă problemă, alt issue.
- Sortarea după numărul de pets — datele n-o justifică (max 2).
- „All" ca opțiune de mărime a paginii.
- Optimizarea `COUNT(*)` (vezi #12).

## Ce contrazice issue-ul, explicit

Issue #25 spune „sortable by **any** column". Livrăm sortare pe **Name și City**, nu pe
Address/Telephone/Pets, fiindcă datele arată că sortarea lor nu produce o ordine pe care
cineva să o ceară. Dacă ești de acord, scriu asta ca un comentariu pe issue înainte să
încep — ca decizia să fie în ticket, nu doar în fișierul ăsta.
