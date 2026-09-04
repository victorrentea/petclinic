# Architecture

Every diagram is **generated from the code** and rendered live via the
[PlantUML proxy](https://plantuml.com/) off the GitHub-hosted `.puml` source —
each carries a `footer` with its own repo path, so the render is self-identifying.

The two `.drawio.png` diagrams are the exception: drawn by hand, but not therefore
unchecked — the mxGraph XML rides inside the picture, and a guardrail test reads it back
and compares it against the code.

#### Deployment (FE → BE → DB)
![Deployment](petclinic-backend/docs/deployment.drawio.png)

> Hand-drawn, and it has to be: the backend cannot
> introspect the Angular SPA or PostgreSQL. It stays honest anyway — it is a `.drawio.png`,
> so the mxGraph XML rides inside the picture (open it in the draw.io desktop app and edit
> it in place), and every box and arrow carries metadata that `DeploymentDiagramTest`
> checks against the sequence diagrams generated from real traces.

#### Domain model
![Domain model](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DomainModel.puml)

#### Conceptual model (hand-arranged)
![Conceptual model](petclinic-backend/docs/ConceptualModel.drawio.png)

> The same concepts and links as above, but laid out by people and staying where they were
> put — which is the whole point, since PlantUML re-arranges its own diagram on every
> regeneration and resets everyone's spatial memory of it. `ConceptualModelDiagramTest` owns
> the content (every box, line and cardinality must match the domain classes) and never the
> positions; a new concept is parked in the staging lane on the left by
> `docs/scripts/conceptual-model-patch.py` and keeps the build red until a human places it.

#### Database (ER)
![Database](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DB.puml)

#### Packages (logical architecture)
![Packages](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/packages.puml)

#### E2E sequence (from real traces)
![E2E sequence](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-test/src/add-visit.spec.ts.genseq.puml)

#### C4 — System Context
![C4 System Context](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/c4views/C1-Context.puml)

> More C4 views (containers, per-component focus) live in
> [`petclinic-backend/docs/README.md`](petclinic-backend/docs/README.md).
