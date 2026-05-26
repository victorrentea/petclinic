# Batch Events în Event-Sourced Systems

## Contextul problemei

Event-sourced system unde o operațiune produce ~200.000 inserturi de events în 3+ agregate, într-o singură tranzacție. JPA nu face batching, deci a fost construit un mecanism custom care colectează inserturile și le trimite la DB într-un singur round-trip TCP.

### Schimbarea de ordine

**Înainte (secvențial):**
```
insert E1
∄/❌ policy pt E1 → insert Ep3(B)
insert E2(B)
∄/❌ policy pt E2 → insert Ep4
```

**Acum (batched):**
```
insert E1
insert E2(B)
policy pt E1 → insert Ep3(B)   ← vede B deja modificat de E2!
policy pt E2 → insert Ep4
```

Asta sparge **causal consistency**: `policy(E1)` emite `Ep3` pe agregatul B, dar B a fost deja modificat de E2 în același batch. Policy-ul vede o stare diferită față de execuția secvențială.

## Soluțiile propuse în discuție

### Soluția 1 — API explicit `applyEventsBatchWithoutPolicies`

```java
applyEventsBatchWithoutPolicies(List<Event> events)  // țipi la dev
```

Developer-ul declară explicit intenția: "știu ce fac, nu rula policies".

- **Pro:** contract explicit
- **Contra:** se bazează pe disciplină
- **Recomandare:** combină cu marker interface `Batchable` pe Event pentru verificare statică

### Soluția 2 — ThreadLocal runtime check

```java
// pe mediul de testare, se rulează de fapt apply normal
if (peMediulDeTestare) {
  try {
    threadLocal.set(naivoieSaFaciApplyEvent);  // de aici
    applyPolicy(event);
  } finally {
    threadLocal.remove();  // pana aici
  }
}

// in #apply(event)
if (peMediulDeTestare && threadLocal.get() == true) {
  throw new IllegalStateException(
    "N-ai fost atent pe 26 mai 2026 la 14:46");
}
```

- **Pro:** prinde violări la runtime
- **Contra:** "dark magic" cu ThreadLocal; prinde doar ce execută testele
- **Recomandare:** activează și în dev/staging, nu doar test. Costul `threadLocal.get()` într-un `apply` e zero comparativ cu corupția istoriei.

### Soluția 3 — Prevenție prin reflection + @Test

Static, la build time:

1. Prin reflection, extragi din toate clasele de Event asocierea **Event type ↔ Aggregate type**. Generezi un tabel pe git printr-un `@Test`.

2. În interfața `Policy`, adaugi două metode default:

   ```java
   List<Class<? extends Event>> eventsListened();
   List<Class<? extends Aggregate>> aggrListened();
   ```

3. `@Test` trece prin toate policies și verifică: **există vreun policy care ascultă pe un event marcat `Batchable` sau pe agregatul unui astfel de event?** Dacă da → fail.

4. Metoda `applyEventsBatchWithoutPolicies(List<Event>)` verifică la runtime că toate eventele primite sunt `Batchable`.

**Canary test (gluma lui Alex, dar serios):** mai faci un test cu un event care există doar în `src/test`. Dacă se trigger-uiește orice policy → înseamnă că ai un **policy gol/global** care ascultă la tot. Fail.

## Cazuri clasice care lipsesc

### 1. Read-during-policy (cel mai subtil bug)

Discuția s-a concentrat pe policies care **emit** events. Dar dacă un policy **citește** starea unui agregat ca să decidă?

În batch-mode, când rulează `policy(E1)`, B are deja E2 aplicat în DB. Policy-ul vede "viitorul". Nu există alterare a istoriei, dar logica e greșită. Validarea propusă prinde insert-uri, nu citiri.

**Soluție:** rulează policies pe snapshot al stării de dinaintea batch-ului (replay până la versiunea X).

### 2. Version monotonicity pe agregat

Într-un event store serios, fiecare event are `aggregateVersion` strict crescător. Dacă `Ep3(B)` (din `policy(E1)`) e inserat după `E2(B)`, primește versiune mai mare ca E2 — dar semantic ar fi trebuit să fie între E1 și E2. **Istoria devine minciună la replay.**

Verifică dacă event store-ul atribuie versiuni la insert sau pre-batch.

### 3. Replay safety

La replay (reconstrucție agregat sau regenerare read-model), se vede `E1, E2, Ep3, Ep4` în ordinea storage. Replay-ul reaplică policies pe E1, E2 — dar policies-urile sunt **deja materializate** ca Ep3, Ep4.

Ai flag pe events ca să distingi "originating" vs "policy-generated"? Altfel pe replay re-trigerezi policies → duplicare → corupție.

### 4. Bulk-as-domain-concept (modelare, nu tactică)

Sfârșitul discuției cu autorizările pe 1000 de linii arată simptomul real: **aggregate boundary prea mare**. Soluția canonică DDD nu e batch-insert, e un singur event `BulkAuthorizationApplied` cu payload agregat, urmat de snapshot.

200k events pentru o operațiune e un smell. Întrebare: poate `cerereCheltuială` ar trebui să fie root cu linii ca **value objects** într-un singur event, nu copii cu propriile streams?

### 5. Side effects pe rollback

Notificările trec prin outbox — bun. Dar policies au voie să facă **alte side effects** (API calls externe, scriere în Redis, etc.)? Dacă batch-ul rollback-uiește, side-effect-urile alea rămân.

Marker `Batchable` + `policiesListened == ∅` ar trebui verificat și pentru asta, nu doar pentru re-publicare de events.

### 6. Concurrent batches pe același agregat

Optimistic locking pe versiune ar trebui să prindă, dar verifică explicit: dacă două tranzacții batch lovesc agregatul B concurent, ce se întâmplă? Una eșuează cu OCC exception sau ambele commit cu versiuni intercalate?

### 7. Snapshot generation

Dacă există snapshot-uri pe agregate (probabil sunt la 30k events), batch-ul scurtcircuitează triggerii de snapshot? Pe replay viitor, fără snapshot, vei reaplica 30k events.

## Recomandare finală

1. **Modelare întâi:** convingeți-vă că batch-ul de 200k nu e simptom de aggregate prea mare. Probabil este.

2. **Dacă rămâneți pe abordarea actuală, combinați toate trei soluțiile:**
   - `Batchable` marker interface + reflection-test (prevenție la CI)
   - ThreadLocal assertion (detection în runtime, activă în dev/staging)
   - API explicit `applyEventsBatchWithoutPolicies` (intenție declarată)

3. **Adăugați check pentru read-side în policies**, nu doar write-side.

4. **Documentați în ADR** de ce batch-ul nu rulează policies și ce cazuri sunt explicit excluse.
