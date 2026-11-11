# Q&A — issue #25: paginare și sortare în grid-ul de owneri

Issue-ul: grid-ul de owneri sortabil după orice coloană, paginat în pagini de 5, 10 sau 20 de rânduri.

## Întrebări și răspunsuri

**1. Sortarea și paginarea se fac pe server (Postgres) sau în browser, peste lista întreagă?**
Pe server. Bizu estimează ~100k owneri în tabelă într-un an, deci nicio listă de owneri nu se mai
încarcă întreagă (trecut și în `AGENTS.md`).

**2. Cum arată API-ul?**
Același `GET /api/owners`, care primește `?lastName=&page=&size=&sort=` și întoarce o pagină
`{content, totalElements, totalPages, number, size}` (forma din `owner-page.ts`). E breaking, dar
singurii consumatori sunt grid-ul Angular și `OwnerSearchThroughLatencyProxyTest`.

**3. Coloana Pets (listă de animale) e sortabilă?**
Nu.

**4. Name sortează după nume, apoi prenume?**
Nitpick, decide agentul: nume, apoi prenume, apoi id. Se schimbă ușor după demo, dacă Bizu vrea altfel.

**5. Demo-ul pentru Bizu pe cei 26 de owneri din seed sau pe un set de 100k?**
Doar cei 26.

**6. Telephone e sortabilă?**
Nu. Telefoanele sunt salvate în formate amestecate (`(0044)…`, `+44…`, `0034…`), și la fel în
producție. Normalizarea lor ar fi un issue separat.

**7. Address e sortabilă?**
Nu. Unele adrese încep cu numărul, altele cu strada. Rămân sortabile doar **Name** și **City**.

## Decise de agent (de schimbat în review dacă e cazul)

- City sortează după oraș, apoi nume, prenume, id. Id-ul departajează mereu, ca un owner să nu
  apară pe două pagini.
- Implicit: pagina 1, 10 rânduri, sortat după Name crescător. `size` în afară de 5/10/20 sau `sort`
  pe alt câmp decât Name/City → 400.
- Căutarea după nume se combină cu paginarea; o căutare nouă te duce pe pagina 1.
- Pagina, sortarea și filtrul stau în URL, ca Back din detaliul unui owner să revină unde erai.
- Răspunsul e un DTO scris de mână, nu `PageImpl` serializat direct (Spring Boot 3.5 avertizează și
  produce altă formă).
- Animalele se încarcă fără N+1 (fetch în batch); paginarea nu se face în memorie.
- Colația bazei sortează corect diacriticele („Śliwiński” după „Silver”), deci nu e nevoie de nimic.
- Teste: backend cu MockMvc, unitare Angular, un e2e Playwright pe cei 26 de owneri, plus
  `OwnerSearchThroughLatencyProxyTest` adaptat la noul răspuns.
