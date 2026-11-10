# Issue #25 — Paginare și sortare în grid-ul Owners

Rezultatul unei sesiuni `/grill-me` pe [#25](https://github.com/victorrentea/petclinic/issues/25)
(„sortable by any column, paginated in pages of 5, 10, or 20 rows”), 10 nov 2026.

## Decise

| # | Întrebare | Răspuns | Pe ce s-a bazat |
|---|---|---|---|
| 1 | Câți owneri trebuie să suporte? | ~50.000 într-un an (estimarea lui Bizu); seed-ul are 26. Notat și în `AGENTS.md`. | Telefon cu Bizu |
| 2 | Unde se face paginarea și sortarea? | Pe server | La 50k de owneri cu animale, browserul nu poate descărca tot |
| 3 | Endpoint nou sau îl schimbăm pe cel existent? | Se schimbă chiar `GET /api/owners`, care întoarce mereu o pagină | Diagrama `Deployment.drawio.png` și codul arată că doar grid-ul din Angular citește lista. Chatbot-ul cheamă `/api/specialties/feed` și MCP-ul, care caută ownerul după id. Health check-urile verifică doar status 200. JMeter face doar `POST`. |
| 4 | Ce formă are răspunsul? | `PagedModel<OwnerDto>`, cu `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` | E forma stabilă recomandată de Spring Data și o înțelege springdoc |
| 5 | Pe ce coloane se poate sorta? | **Name** și **City**. Address, Telephone și Pets nu se sortează. | Datele reale: adresele sunt text liber (`12 Boltzmanngasse`, `ul. Floriańska 14`), telefoanele au 4 formate amestecate, fiecare owner are 1–2 animale |
| 6 | Cum afișăm numele? | O singură coloană, „McCallister, Kevin”; se sortează după `last_name, first_name, id` | Când ecranul arăta „Kevin McCallister”, sortarea după numele de familie părea amestecată |
| 7 | Cum ordonăm diacriticele? | `COLLATE "und-x-icu"` pe `last_name`, `first_name` și `city`, printr-o migrare Flyway | Cu collation-ul `C.UTF-8`, `Śliwiński` ajunge după `Z…`. Postgres 16.2 din zonky are ICU (785 de collation-uri). |
| 8 | Ce indexuri adăugăm? | `(last_name, first_name, id)` și `(city, last_name, first_name, id)`, în aceeași migrare. Le verificăm cu EXPLAIN ANALYZE pe 50k de owneri generați local, care nu ajung în seed. | Tabela `owners` are acum doar cheia primară; `id` la final ține paginarea stabilă |

## Propuse, încă neconfirmate

| # | Întrebare | Răspunsul propus | De ce |
|---|---|---|---|
| 9 | Cum încărcăm animalele pentru o pagină de owneri? | O interogare pentru pagină, apoi animalele cu `@BatchSize` sau `@EntityGraph`. **Fără** `JOIN FETCH` pe colecție în query-ul paginat. | `fetch join` pe o colecție împreună cu `Pageable` paginează în memorie (HHH90003004), adică încarcă toți cei 50k |
| 10 | Ce câmpuri de sortare acceptă backend-ul? | Doar `lastName` și `city`, cu `asc` sau `desc`. Orice alt câmp primește 400. | Altfel ajung în ORDER BY coloane fără index, sau apare o excepție de mapare |
| 11 | Size implicit și maxim | Implicit 10, maxim 20 (`spring.data.web.pageable.max-page-size=20`). UI-ul oferă 5, 10 și 20. | `?size=50000` ar reînvia riscul pe care îl eliminăm |
| 12 | Sortarea implicită | Name ascendent | Recepția caută după numele de familie |
| 13 | Cum se combină căutarea cu paginarea? | `lastName` rămâne filtru pe același endpoint. O căutare nouă duce la pagina 0 și păstrează sortarea. | Altfel rămâi pe pagina 4 a unui rezultat cu 3 rânduri |
| 14 | Se păstrează starea în URL? | Da: `/owners?page=2&size=10&sort=city,asc` | Refresh-ul, butonul Back și link-urile partajate arată aceeași pagină |
| 15 | Cu ce componente facem grid-ul în UI? | `mat-paginator` + `matSort` pe tabelul existent, cu `disableClear`, deci doar asc sau desc. Nicio componentă în design-system deocamdată. | Material e deja în proiect și dă `aria-sort` gratis. YAGNI până apare al doilea grid paginat. |
| 16 | Căutarea după prefix, pe coloane cu ICU | Rămâne `StartingWith`, cu diferență între litere mari și mici. Issue separat dacă vrem să nu mai conteze. | `LIKE 'Dav%'` pe o coloană ICU nu folosește btree-ul; la 50k e un seq scan de câțiva ms |
| 17 | Page sau Slice? | `Page`, cu `count(*)` | Paginatorul are nevoie de total, iar count-ul durează câțiva ms la 50k |
| 18 | O pagină care nu există (`page=99`) | Backend-ul întoarce `content: []` cu totalurile; UI-ul sare pe ultima pagină validă | Se poate întâmpla după o ștergere sau cu un URL vechi |
| 19 | Mesajul pentru zero rezultate | Se afișează când `totalElements == 0`, nu când `owners == null` | „Gol” nu înseamnă „eroare” |
| 20 | Merge ICU și în Docker și în teste? | Da (zonky și imaginea oficială `postgres` au ICU). Confirmăm rulând stack-ul Docker în e2e. | Migrarea nu trebuie să crape într-un singur mediu |
| 21 | Teste (TDD) | **Backend:** paginare, totaluri, 400 pentru sort nepermis, `Śliwiński` între `Silver` și `T…`, plafonul de 20. **Frontend:** spec pentru componentă. **E2e:** scenariu în `owner-search.feature`, plus actualizarea `add-owner.spec` și `owner-search.feature.glue` pentru „Last, First”. | Fiecare decizie are un test care pică dacă e încălcată |
| 22 | Ce regenerăm | `api-types.ts` din OpenAPI și `ApiExamples.OWNERS` | Un contract schimbat lasă în urmă tipuri TS vechi |
| 23 | Pe ce ramură lucrăm? | Ramură nouă din `main` (`owners-pagination`), cu PR spre `main` | `mm26nov` e ramura workshop-ului |
| 24 | Îl anunțăm pe Bizu? | Un comentariu pe #25 cu deciziile, mai ales de ce Address, Telephone și Pets nu se sortează | Issue-ul cere „any column”, deci renunțăm la o parte din cerință |
| 25 | Normalizarea telefoanelor la E.164 | Issue separat, în afara #25 | Abia după normalizare are sens sortarea după telefon |
