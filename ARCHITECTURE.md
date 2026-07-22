# Architecture

Every diagram is **generated from the code** and rendered live via the
[PlantUML proxy](https://plantuml.com/) off the GitHub-hosted `.puml` source —
each carries a `footer` with its own repo path, so the render is self-identifying.

#### Domain model
![Domain model](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DomainModel.puml)

#### Database (ER)
![Database](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/DB.puml)

#### Packages (logical architecture)
![Packages](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/packages.puml)

#### E2E sequence (from real traces)
![E2E sequence](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-ui-test/features/generated_sequences/add-a-visit-to-an-existing-pet.puml)

#### C4 — System Context
![C4 System Context](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/victorrentea/petclinic/main/petclinic-backend/docs/generated/c4views/C1-Context.puml)

#### Code City (3D)
[Open the Code City in your browser →](https://victorrentea.github.io/petclinic/petclinic-backend/docs/generated/codemap/codecity.html)

> More C4 views (containers, per-component focus) live in
> [`petclinic-backend/docs/README.md`](petclinic-backend/docs/README.md).
