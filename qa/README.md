# QA E2E Tests (Playwright)

Suita QA din acest folder foloseste JavaScript + Playwright pentru validarea paginii Owners:
- paginare;
- schimbare page size;
- navigare previous/next/last;
- sortare prin query param;
- cautare cu reset la prima pagina;
- comparatie UI vs API pentru ordinea ownerilor.

## Cerinte
- Node.js 20+
- frontend pornit (implicit: `http://localhost:4200/petclinic`)
- backend pornit (implicit: `http://localhost:8080/api`)

## Instalare
Din folderul `qa`:

```sh
npm install
npm run install:browsers
```

## Rulare
Toata suita:

```sh
npm test
```

Doar testele de owners pagination/sorting:

```sh
npm run test:owners
```

Script convenabil (instalare dependinte la nevoie + rulare owners suite):

```sh
./run-tests.sh
```

Cu URL-uri custom:

```sh
BASE_URL=https://your-frontend-host/petclinic API_BASE_URL=https://your-backend-host/api npm run test:owners
```

Mod headed (debug vizual):

```sh
npm run test:headed
```

## Structura
- `playwright.config.js` - configurare Playwright
- `tests/owners-pagination.spec.js` - cele 7 scenarii E2E cerute
