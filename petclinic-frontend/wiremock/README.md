# Mock backend (optional)

A one-command, standalone [WireMock](https://wiremock.org/) that serves the **canned response
examples** baked into the Swagger — the same examples hard-coded in Java
(`petclinic-backend/.../rest/ApiExamples.java`), exported by springdoc into the repo-root
`openapi.yaml`. It's the PetClinic take on the AI-workshop's `:wiremock` trick.

The backend itself has **no** dependency on WireMock; this is a developer convenience only.

## Why

WireMock and the real Spring backend both listen on `:8080`, so this is an **alternative** to the
backend — handy to demo or develop the frontend with no database/backend running:

1. Stop the real backend.
2. `./start.sh`
3. Open the Angular app (http://localhost:4200). It talks to `:8080` as usual and now sees the
   canned example data.

## Run

```bash
./start.sh                 # regenerate stubs from ../../openapi.yaml, serve on :8080
PORT=9090 ./start.sh       # different port
USE_DOCKER=1 ./start.sh    # use the wiremock/wiremock Docker image instead of a jar
```

Requires Node (for stub generation) and either a JDK or Docker (to run WireMock). The standalone
jar is reused from your local Maven repo if present, otherwise downloaded once into `.cache/`.

```bash
curl http://localhost:8080/api/vets          # one of the canned responses
curl http://localhost:8080/__admin/requests  # WireMock request journal
```

## How it works

`generate-mappings.mjs` reads `../../openapi.yaml`, pulls the `application/json` example out of each
operation's response, and writes one WireMock stub per endpoint into `mappings/`. Because the
examples live in Java → flow into the Swagger → become the stubs, the mock can't drift from the
documented contract. `mappings/` is regenerated on every run and is git-ignored.
