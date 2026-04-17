# Structurizr C4 Model Extractor — Design

## Overview

Add a Structurizr-based C4 model extractor to the petclinic-backend that:
1. Scans the backend classpath using ArchUnit to discover packages and their dependencies
2. Builds a Structurizr workspace in memory
3. Exports `petclinic-backend/docs/C4 model.dsl` (full workspace DSL including view definitions)
4. Renders the DSL's views as PlantUML files in `petclinic-backend/docs/views/`

## Maven Dependencies

Add to `petclinic-backend/pom.xml` with `<scope>test</scope>`:

- `com.structurizr:structurizr-core` — workspace model API (Person, SoftwareSystem, Container, Component)
- `com.structurizr:structurizr-export` — DSL exporter + PlantUML exporter

ArchUnit (`com.tngtech.archunit:archunit-junit5`) is already present for class scanning.

## Java Implementation

### Location

`petclinic-backend/src/test/java/org/springframework/samples/petclinic/architecture/C4ModelExtractor.java`

Placed in the existing `architecture` test package alongside `ArchitectureTest`.

### Class Responsibilities

`C4ModelExtractor` is a JUnit test class with a single `@Test` method that:
1. Imports classes from the petclinic packages using ArchUnit's `ClassFileImporter`
2. Constructs a Structurizr `Workspace` with hardcoded top-level elements and auto-extracted components
3. Adds dependency relationships between components derived from `JavaClass.getDirectDependenciesFromSelf()`
4. Exports the workspace to DSL and PlantUML

### C4 Model Structure

**Hardcoded elements (cannot be inferred from bytecode):**

| Element | Type | Tech |
|---|---|---|
| Pet Owner | Person | — |
| Veterinarian | Person | — |
| PetClinic | SoftwareSystem | — |
| Backend | Container | Java / Spring Boot |
| Frontend | Container | React |
| Database | Container | H2 / PostgreSQL |

**Auto-extracted components (from package scan):**

| Package(s) | Component Name |
|---|---|
| `..model` | Domain Model |
| `..repository` | Repository Layer |
| `..mapper` | Mapper Layer |
| `..rest` + `..rest.dto` + `..rest.error` | REST Layer |
| `..security` | Security |
| `..invoice` | Invoice |
| `..util` | Utilities |

Inter-component dependencies are derived from ArchUnit's `JavaClass.getDirectDependenciesFromSelf()`, filtered to only include relationships between the mapped component groups.

### Views Defined in DSL

The exported DSL's `views {}` block contains:

1. **Container view** (`container petclinic`) — shows PetClinic's containers and the two Person actors
2. **Component view** (`component backend`) — shows all auto-extracted components inside the Backend container with their dependencies

Both views use `autoLayout`.

## Output Files

| File | Description |
|---|---|
| `petclinic-backend/docs/C4 model.dsl` | Full Structurizr DSL workspace |
| `petclinic-backend/docs/views/container-view.puml` | PlantUML for the container view |
| `petclinic-backend/docs/views/component-view.puml` | PlantUML for the component view |

## How to Run

```bash
cd petclinic-backend
mvn test -Dtest=C4ModelExtractor
```

Output files are committed to the repository alongside the existing `docs/architecture.puml`.

## Constraints

- The extractor is read-only — it does not modify any existing test or source file
- It does not replace `ArchitectureTest`; both coexist in the `architecture` package
- Output files are overwritten on each run (idempotent)
