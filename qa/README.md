# QA Blackbox Tests (Selenium)

Suită simplă Java + Selenium pentru verificarea ecranului Owners din aplicația deployată.

## Prerequisites
- Java 21+
- Chrome instalat
- frontend disponibil la `http://localhost:4200`
- backend disponibil la `http://localhost:8080`

## Run
Din folderul `qa`:

```sh
mvn test
```

Cu URL-uri custom:

```sh
mvn test -DbaseUrl=https://your-frontend-host -DapiBaseUrl=https://your-backend-host/api
```

## Ce verifică testele
- la încărcarea paginii Owners se afișează toți ownerii;
- după search după prefix de last name, sunt afișați doar ownerii potriviți.
