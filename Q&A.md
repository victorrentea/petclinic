# #25 — Paginare și sortare pe grila Owners: întrebări și răspunsuri aprobate

Issue: [#25 Add pagination to Owners grid](https://github.com/victorrentea/petclinic/issues/25) —
grila sortabilă după orice coloană, paginată în pagini de 5, 10 sau 20 de rânduri.

Status: **toate răspunsurile de mai jos sunt aprobate** (2026-10-23).
Volumele de producție care stau la baza deciziilor: [volumetrii.md](volumetrii.md).

## API

**Q1. Unde se face paginarea și sortarea: pe server sau în browser?**
Pe server. Business țintește ~50.000 de owneri într-un an; o paginare în browser ar descărca
oricum toți ownerii cu toate animalele, deci ar fi doar cosmetică.

**Q2. Schimbăm `GET /api/owners` pe loc sau adăugăm un endpoint nou?**
Pe loc, breaking: răspunsul devine o pagină în loc de array. Toți consumatorii sunt în repo
(grila Angular, testele, `start-apps.ts`, care verifică doar HTTP 200). Diagrama de deployment
arată doar Frontend și Chatbot ca apelanți ai backend-ului, iar chatbotul folosește doar
`/api/owners/{id}`. Un `GET /api/owners` nepaginat, păstrat „pentru compatibilitate”, ar fi
tocmai bomba de 50k pe care o dezamorsăm.

**Q3. Ce formă are răspunsul?**
Un DTO scris de mână, `OwnerPageDto { content: OwnerDto[], totalElements: number }`, conform
convenției proiectului. Nu `Page<OwnerDto>` (JSON-ul lui `PageImpl` nu e stabil) și nici
`PagedModel` (ar lega forma API-ului de Spring Data).

**Q4. Ce parametri primește?**
`page` (numerotat de la 0), `size`, `sort` ∈ {`name`, `address`, `city`}, `dir` ∈ {`asc`, `desc`},
plus `lastName`, care există deja. Cheile de sortare sunt un enum, nu nume de coloane, iar o
cheie necunoscută dă 400.

**Q5. Ce valori are voie `size` să ia?**
Doar 5, 10 sau 20, implicit 10. Orice altă valoare dă 400, altfel `size=50000` ar ocoli
paginarea.

**Q6. Care e sortarea implicită?**
După Name, crescător.

**Q7. Cum se combină paginarea cu căutarea după `lastName`?**
Filtrul rămâne și se aplică înaintea paginării; `totalElements` numără rezultatele de după filtru.

## Coloane sortabile

**Q8. Se poate sorta după Telephone?**
Nu. Datele au formate amestecate (`(0044)…`, `+44…`, `0119…`, `8474461990`), deci sortarea ca
text n-ar avea sens. Normalizarea la E.164 e un subiect separat, pe care îl ține minte Victor.

**Q9. Cum se sortează după Name?**
După `first_name, last_name, id`; `id` departajează omonimii (`Darling` ×2, `Potter` ×2) și ține
paginile stabile. *Recomandarea mea a fost `last_name, first_name, id`, pentru consecvență cu
căutarea după nume de familie; Victor a ales ordinea după prenume.*

**Q10. Ce facem cu diacriticele?**
Baza de date are collation `C`, așa că `Śliwiński` iese după `Wensleydale`. Punem collation ICU
(`und-x-icu`, disponibil și determinist în Postgres 16) pe `first_name`, `last_name`, `address`
și `city`, printr-o migrare. Nu schimbăm collation-ul la nivelul întregii baze.

**Q11. Se poate sorta după Pets?**
Nu. Sortarea după numărul de animale ar cere la 50k de owneri un `count()` neindexat pe fiecare
pagină, iar sortarea după numele primului animal ar părea arbitrară.

**Q12. Cum se sortează după Address și City?**
Cu collation ICU și `id` ca departajare (`London` apare de 5 ori). Adresele se sortează ca text,
deci după numărul casei; e comportamentul normal al unei grile.

## Bază de date și performanță

**Q13. Ce indexuri adăugăm?**
Azi `owners` are doar cheia primară. Adăugăm:
- `(first_name, last_name, id)` cu ICU, pentru sortarea implicită;
- `(last_name text_pattern_ops)`, pentru căutarea `LIKE 'x%'`, pe care un index ICU obișnuit
  nu o poate folosi.

Pentru `address` și `city` nu punem index până nu arată `EXPLAIN ANALYZE` pe 50k de rânduri că
e nevoie: un `ORDER BY … LIMIT 20` pe 50k de rânduri e un top-N sort de câteva milisecunde.

**Q14. Cum evităm N+1 la încărcarea animalelor?**
`Owner.pets` e LAZY, deci o pagină de 20 ar face 21 de query-uri. Punem `@BatchSize(size = 20)`
pe `Owner.pets`. Nu folosim `JOIN FETCH` împreună cu `Pageable`, pentru că Hibernate ar pagina
atunci în memorie, peste toți ownerii.

**Q15. Offset sau keyset?**
Offset: la 50k de rânduri e suficient și permite saltul direct la pagina N.

**Q16. Ce migrare scriem?**
Una singură, versionată: `db/migration/V{n}__owners_icu_collation_and_indexes.sql`.

**Q17. Cum verificăm că rezistă la volum?**
Generăm 50k de owneri cu `generate_series` și rulăm `EXPLAIN ANALYZE` pe sortarea implicită și
pe căutarea după prefix.

## Frontend

**Q18. Ce componente folosim?**
`mat-table` cu `matSort` și `mat-paginator` în mod server-side (Angular Material 16.2.1 e deja
în dependențe), iar cererile trec prin `switchMap`, ca doar ultimul răspuns să ajungă în grilă.
Mutăm grila în `design-system/` abia când apare a doua grilă.

**Q19. Când revenim la pagina 0?**
La o căutare nouă și la schimbarea mărimii paginii. Sortarea curentă se păstrează.

**Q20. Ținem starea grilei în URL?**
Da, `?page=&size=&sort=&dir=`, ca refresh-ul și butonul Back să păstreze pagina. E opțional;
poate fi tăiat dacă îngreunează livrarea.

**Q21. Când afișăm mesajul „No owners…”?**
Când `totalElements === 0`. Azi mesajul apare doar la eroare (`!owners`), nu și la o listă goală.

## Livrare

**Q22. Cum testăm?**
TDD: `OwnerTest`, scenariul Cucumber din `owners.feature`, spec-ul Angular al grilei și un test
Playwright. Regenerăm `openapi.yaml` (prin `OpenApiExtractorTest`) și `api-types.ts`.

**Q23. Comunicăm pe issue de ce Telephone și Pets nu sunt sortabile?**
Da, printr-un comentariu pe #25 care explică motivele de la Q8 și Q11.

## Rămase deschise

- **Latența țintă pentru o pagină.** Business n-a dat o cifră; [volumetrii.md](volumetrii.md)
  nu are încă o cerință de latență.
- **Q9 față de Q7.** Name se sortează după prenume, dar căutarea se face după nume de familie:
  cine caută „Potter” vede rezultatele ordonate după prenume.
