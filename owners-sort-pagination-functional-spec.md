# Owners — Sortare & Paginare · Spec funcțional (#25)

> Nivel **funcțional / UX**. Fără detalii de implementare.
> Rezultatul unei sesiuni de rafinare cu business-ul. Sursă: GitHub issue #25
> „Add sorting and pagination to Owners screen”.
> Intenție: input pentru change-ul OpenSpec `owners-sort-pagination`.

## Context

Ecranul **Owners** afișează lista clienților clinicii. Coloane afișate:
**Nume, Adresă, Oraș, Telefon, Pets**. Pe ecran **există deja căutare**
(NU face parte din acest issue — doar trebuie să ne integrăm corect cu ea).

---

## 1. Sortare

| Decizie | Valoare |
|---|---|
| Coloane sortabile | **Nume, Oraș, Adresă** |
| Coloane NEsortabile | Telefon (fără valoare de sortare), Pets (listă compusă, fără ordine naturală) |
| Mod toggle | Click pe alt antet → ascendent pe el; click repetat → alternează **asc ↔ desc**. O singură coloană activă. **Nu există** stare „nesortat”. |
| Domeniu sortare | Pe **toată lista** (toți owners), nu doar pe pagina vizibilă. |
| Indicator vizual | **Săgeată ↑/↓ pe coloana activă**. Celelalte coloane sortabile semnalează discret (ex. la hover) că sunt sortabile. |
| Colare text | **„Ca un om”** — insensibil la majuscule și diacritice (`Popescu` = `popescu` = `Pópescu`). |
| Sortare implicită la deschidere | **Nume, ascendent**, cu săgeata vizibilă. |
| Schimbarea sortării | → revine la **pagina 1**. |

### Valori goale
Rândurile cu valoare lipsă pe coloana de sortare (ex. fără oraș) sunt tratate ca
**șir gol**: apar **primele la ascendent**, ultimele la descendent.

> ⚠️ **Decizie conștientă (tensiune semnalată):** la A→Z, un bloc de rânduri goale
> apare în capul listei. Consistent matematic, dar poate genera întrebări la demo
> („de ce-mi apar goale primele?”). Acceptat ca atare.

---

## 2. Paginare

| Decizie | Valoare |
|---|---|
| Controale (bara de jos) | **Selector mărime** + **contor poziție/total** + **săgeți** prima / anterioara / următoarea / ultima. |
| Mărimi de pagină | **5 / 10 / 20**, default **10**. |
| Contor | Format „**11–20 din 53**” (poziția curentă + total). |
| Schimbarea mărimii de pagină | → revine la **pagina 1**. |
| Memorarea mărimii între vizite | **Nu.** Fiecare vizită nouă pornește la 10. (Trăiește doar în sesiune + în linkul partajat — vezi §5.) |

### Listă mică (ascunderea barei)
- **≤ 5 owners** (sub cea mai mică mărime de pagină) → bara de jos **dispare complet**
  (nici la 5/pagină n-ar exista a doua pagină). Sortarea pe antete **rămâne** activă.
- **≥ 6 owners** → bara apare mereu (selector + contor + săgeți, după caz).

> Prag stabil: nu „pâlpâie” când utilizatorul schimbă mărimea de pagină.

---

## 3. Interacțiunea Sortare × Paginare

- Sortarea se aplică pe întreaga listă, deci pagina 1 după sortare arată
  primele rânduri din **noua** ordine.
- Orice schimbare de sortare → **pagina 1**.

---

## 4. Interacțiunea cu Căutarea *(căutarea există deja; nu o construim în #25)*

- Căutarea filtrează **toată lista**; rezultatele rămân **sortate și paginate**.
- Contorul arată **totalul filtrat** (ex. „1–10 din 23”).
- Schimbarea termenului de căutare → **pagina 1**.
- **Pagină devenită invalidă:** dacă filtrul reduce rezultatele și pagina curentă
  nu mai există → utilizatorul ajunge la **pagina 1**.
  (Singurul declanșator de „pagină invalidă” e căutarea; presupunem că ecranul
  **nu** are ștergere. Dacă apare ștergerea, regula se reevaluează separat.)

---

## 5. Persistență & partajare

- Starea ecranului — **sortare + pagină + căutare** — **supraviețuiește navigării**:
  la întoarcerea pe ecran te regăsești exact unde erai.
- Starea se **reflectă în adresa paginii** → **link partajabil / bookmark**
  („uite lista din Iași, pagina 2”).

---

## 6. Stare goală

- **Un singur mesaj generic** („Niciun rezultat”), identic pentru:
  - clinică nouă / fără owners, și
  - căutare fără rezultate.
- Controalele de paginare nu au sens la 0 rezultate (vezi pragul de la §2).

> ⚠️ **Decizie conștientă (tensiune semnalată):** mesaj generic vs. abordarea
> atentă-la-context din restul specului. Compromis acceptat: nu îndrumă explicit
> utilizatorul cum să iasă (ex. „golește filtrul”).

---

## Reguli de aur (rezumat)

1. **Căutare + sortare + paginare = un singur sistem coerent.** Sortarea și
   căutarea lucrează pe întreaga listă; paginarea felietează rezultatul.
2. **Orice resetare de context → pagina 1** (schimbare de sortare, de mărime de
   pagină, sau de termen de căutare).
3. **Mereu o coloană activă de sortare** (default: Nume ascendent).
4. **Sub 6 owners** nu există paginare vizibilă; sortarea rămâne.

---

## În afara scope-ului (#25)

- Construirea căutării (există deja).
- Ștergerea de owners (presupusă inexistentă pe acest ecran).
- Memorarea preferinței de mărime de pagină per dispozitiv sau per cont.
- Multi-sort (sortare după mai multe coloane).

## Neabordate încă (de decis la nevoie)

- Accesibilitate / operare din tastatură a antetelor de sortare; anunțuri pentru
  cititoare de ecran.
- Comportament la volume mari de date (mii de owners) — preponderent
  implementare/performanță, nu UX.
