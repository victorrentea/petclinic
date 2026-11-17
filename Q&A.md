# Q&A - Paginarea și sortarea grilei Owners

Discuție din 17 noiembrie 2026 pentru [issue #25](https://github.com/victorrentea/petclinic/issues/25).

Issue-ul cere sortare după orice coloană și pagini de 5, 10 sau 20 de rânduri.
Documentul separă deciziile confirmate de recomandările care nu au fost aprobate explicit.
Nu descrie o implementare deja realizată.

## Decizii confirmate

| Întrebare | Răspuns / decizie |
|---|---|
| Ce volum de date trebuie luat în calcul? | Aproximativ 100.000 de owneri într-un an, estimare de business comunicată în noiembrie 2026. Cifra este consemnată și în [AGENTS.md](AGENTS.md). |
| Paginarea și sortarea se fac pe server sau în browser? | Pe server. Browserul primește numai pagina cerută; filtrarea și sortarea se aplică întregului rezultat, nu numai rândurilor vizibile. |
| Cum sortăm coloana Pets? | Nu o sortăm. Excepție explicită de la cerința inițială „orice coloană”. Au fost discutate sortarea alfabetică după primul nume de animal și sortarea după numărul de animale; ambele au fost respinse în favoarea excepției. |
| Cum afișăm și sortăm coloana Name? | Afișăm „Nume de familie, Prenume” și sortăm după lastName, apoi firstName. Propunerea inițială de a păstra afișarea „Prenume Nume” a fost înlocuită cu această decizie. |
| Cum ordonăm diacriticele? | Alfabetic românește, fără diferență între majuscule și minuscule, pentru nume, adresă și oraș. Decizie explicită după verificarea bazei: `ș` nu ajunge după `z`. Folosim collation românesc la sortare, fără să schimbăm implicit căutarea. |
| Care sunt valorile implicite la prima deschidere? | 10 owneri pe pagină, sortați crescător după numele de familie și prenume. Opțiunile de dimensiune sunt 5, 10 și 20. |
| Cum interacționează căutarea cu paginarea? | Păstrăm căutarea după numele de familie „începe cu”, declanșată prin Find Owner sau Enter. Filtrăm pe server, revenim la prima pagină și păstrăm sortarea și dimensiunea paginii. Căutarea goală revine la toți ownerii. |
| Unde păstrăm pagina, dimensiunea, sortarea și filtrul aplicat? | În parametrii URL. Refresh-ul și Back din detalii trebuie să refacă aceeași stare a listei; linkul poate fi distribuit. Fără parametri se folosesc valorile implicite. |

### Ce dezavantaje are păstrarea stării în URL?

Întrebarea a fost pusă explicit înainte de acceptarea variantei:

- URL-ul devine mai lung, de exemplu `?page=2&size=10&sort=lastName,asc&lastName=Pop`.
  Exemplul nu stabilește încă numele parametrilor sau numerotarea paginilor.
- Filtrul căutat apare în istoricul browserului și în linkurile distribuite.
- Implementarea necesită validarea parametrilor și sincronizarea cu Back/Forward.
- Linkul păstrează criteriile, nu o fotografie a datelor: modificările ulterioare pot schimba rândurile paginii.

Recomandarea a rămas starea în URL și a fost acceptată.

## Întrebări rămase și răspunsuri recomandate

Utilizatorul a cerut oprirea interviului pas cu pas pentru detaliile ușor de ajustat
și prezentarea lor într-un tabel. Recomandările de mai jos au fost ulterior adoptate
explicit la crearea propunerii OpenSpec, pe 17 noiembrie 2026; regula diacriticelor
a fost completată apoi prin decizia de mai sus.

| Întrebare | Răspuns recomandat |
|---|---|
| Schimbăm contractul API existent? | După verificarea consumatorilor, transformăm endpointul existent într-un răspuns paginat și actualizăm frontendul și testele dependente. Nu păstrăm un endpoint ne-paginat separat doar pentru chatbot: acesta nu consumă lista REST de owneri. Vezi verificarea de mai jos. |
| Ce returnează răspunsul paginat? | Ownerii paginii, numărul total de rezultate filtrate, numărul total de pagini, pagina curentă și dimensiunea ei. Forma exactă a contractului rămâne de stabilit. Există deja un tip [OwnerPage](petclinic-frontend/src/app/owners/owner-page.ts) cu aceste câmpuri. |
| Cum tratăm egalitățile între valorile sortate? | Adăugăm ID-ul drept ultim criteriu, pentru o ordine deterministă pe un set de date neschimbat. Nu promitem rezultate înghețate dacă datele se modifică între cereri. |
| Cum sortăm textele? | Alfabetic românește, fără diferență între majuscule și minuscule; aceleași reguli pentru nume, adresă și oraș, inclusiv poziția corectă a diacriticelor. |
| Cum sortăm telefonul? | Ca text, nu ca număr: prefixele și zerourile inițiale sunt semnificative. |
| Cum funcționează clickul pe antet? | Prima apăsare sortează crescător, următoarele alternează crescător/descrescător, fără o stare „nesortat”. O singură coloană activă; Name reprezintă lastName, apoi firstName. Pets nu are control de sortare. |
| Ce facem la schimbarea sortării sau dimensiunii paginii? | Revenim la prima pagină și păstrăm filtrul. Această întrebare a fost prezentată separat, dar nu a primit răspuns înainte de trecerea la tabel. |
| Ce controale de navigare afișăm? | Prima / anterioara / următoarea / ultima, selector 5/10/20 și indicator de forma „11–20 din 100.000”. |
| Ce facem cu parametrii URL invalizi? | UI normalizează la valori valide și corectează URL-ul. API respinge parametrii invalizi cu HTTP 400; sortarea acceptă numai câmpurile permise. |
| Ce facem când pagina nu mai există, de exemplu după ștergeri? | Navigăm la ultima pagină disponibilă. Dacă nu există rezultate, afișăm starea goală. |
| Cum tratăm încărcarea și cererile concurente? | Afișăm un indicator de încărcare; numai ultima cerere poate actualiza lista. Nu prezentăm date vechi ca rezultate ale noilor criterii. |
| Cum tratăm erorile? | Mesaj explicit cu posibilitate de reîncercare, păstrând criteriile. Nu mascăm eroarea drept „niciun owner”. |
| Cum afișăm zero rezultate? | Mesaje distincte pentru „niciun owner înregistrat” și „niciun rezultat pentru filtru”. Add Owner rămâne disponibil. |
| Ce verificăm pentru volumul de 100.000 de owneri? | Paginarea se execută în baza de date, fără încărcarea întregii liste. Verificăm și numărul interogărilor pentru animalele ownerilor afișați. |
| Introducem infrastructură generică pentru toate grilele? | Nu. Refolosim componentele existente, fără extinderea cerinței la alte ecrane. |
| Care sunt testele esențiale? | Sortare globală între pagini, egalități, filtrare cu total corect, limitele paginilor, URL/Back și erori; inclusiv afișarea „Nume, Prenume” și excluderea Pets de la sortare. |

## Verificarea diagramei și a consumatorilor API

### Cine apelează pe cine conform diagramei?

Au fost extrase XML-ul și atributele ascunse din
[Deployment.drawio.png](petclinic-backend/docs/Deployment.drawio.png), nu numai etichetele vizibile.

| Cine | Apelează / folosește | Metadate |
|---|---|---|
| Pet Owner | Frontend | `traced=no`: interacțiunea omului nu este un span. |
| Veterinarian | Frontend | `traced=no`: interacțiunea omului nu este un span. |
| Frontend, Angular, port 4200 | Backend | `traced=yes` |
| Pet Owner | Chatbot | `traced=no`: interacțiunea omului nu este un span. |
| Chatbot, Java / Spring AI, port 8082 | Backend | `traced=no`: chatbotul nu rulează un agent OTel. |
| Chatbot | OpenAI | Atributul `traced` nu este specificat. |
| Backend, Spring Boot, port 8080 | Database, PostgreSQL, port 5432 | `traced=yes` |
| Backend | Notification Service, Spring Boot, port 8090 | `traced=yes` |
| Notification Service | SMS gateway | `traced=yes` |

Diagrama indică doi consumatori ai backendului, Frontend și Chatbot,
dar nu precizează endpointurile consumate de fiecare.

### Chatbotul depinde de contractul listei REST de owneri?

Nu, conform verificării codului din această discuție:

| Consumator / funcționalitate | Apel verificat | Sursă |
|---|---|---|
| Grila Owners | `GET /api/owners`, cu filtru opțional; consumă în prezent un array. | [OwnerService](petclinic-frontend/src/app/owners/owner.service.ts) |
| Chatbot, tool-uri remote | Endpointul `/mcp`. | [RemoteToolsConfig](petclinic-chatbot/src/main/java/victor/training/petclinic/chatbot/assistant/RemoteToolsConfig.java) |
| Tool-ul `get_owner_profile` | Citește ownerul autentificat direct din repository, nu prin controllerul REST. | [PetClinicMcp](petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java) |
| Chatbot, alimentarea RAG | `GET /api/specialties/feed`. | [RagIngestion](petclinic-chatbot/src/main/java/victor/training/petclinic/chatbot/assistant/RagIngestion.java) |
| Testele de vizite și căutare | Consumă lista REST ca array pentru pregătirea datelor. | [add-visit.dsl.ts](petclinic-test/src/add-visit.dsl.ts), [owner-search.feature.glue.ts](petclinic-test/src/owner-search.feature.glue.ts) |

**Evoluția recomandării API:** inițial s-a recomandat păstrarea compatibilității,
până la identificarea consumatorilor. Verificarea a arătat că chatbotul nu depinde
de acest contract. Recomandarea ulterioară este modificarea endpointului existent,
cu actualizarea frontendului, contractului generat și testelor dependente.
Aceasta nu reprezintă o garanție privind eventuali consumatori externi necunoscuți.
