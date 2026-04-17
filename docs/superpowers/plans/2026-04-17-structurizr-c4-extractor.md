# Structurizr C4 Model Extractor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JUnit-based C4 model extractor that scans petclinic backend packages with ArchUnit, generates `petclinic-backend/docs/C4 model.dsl` (with two view definitions), and renders those views as PlantUML files in `petclinic-backend/docs/views/`.

**Architecture:** `C4ModelExtractor` (JUnit test class in the existing `architecture` package) uses ArchUnit's `ClassFileImporter` to scan the classpath, groups classes by sub-package into Structurizr `Component` elements, extracts inter-component dependencies from `JavaClass.getDirectDependenciesFromSelf()`, and writes the in-memory `Workspace` to DSL via `StructurizrDslExporter` and to PlantUML via `StructurizrPlantUMLExporter`. Higher-level C4 elements (Person, SoftwareSystem, Containers) are hardcoded since they cannot be inferred from bytecode.

**Tech Stack:** Structurizr Core 6.1.0, Structurizr Export 6.1.0, ArchUnit 1.3.0 (already present), JUnit 5

---

### Task 1: Add Structurizr Maven Dependencies

**Files:**
- Modify: `petclinic-backend/pom.xml`

- [ ] **Step 1: Add dependencies to pom.xml**

In the `<dependencies>` section, after the existing ArchUnit block, add:

```xml
<dependency>
    <groupId>com.structurizr</groupId>
    <artifactId>structurizr-core</artifactId>
    <version>6.1.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.structurizr</groupId>
    <artifactId>structurizr-export</artifactId>
    <version>6.1.0</version>
    <scope>test</scope>
</dependency>
```

- [ ] **Step 2: Verify compilation**

```bash
cd petclinic-backend
mvn compile -q
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add pom.xml
git commit -m "build: add structurizr-core and structurizr-export 6.1.0 test dependencies"
```

---

### Task 2: Write Failing Test Skeleton

**Files:**
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/architecture/C4ModelExtractor.java`

- [ ] **Step 1: Create the skeleton**

```java
package org.springframework.samples.petclinic.architecture;

import com.structurizr.Workspace;
import com.structurizr.export.Diagram;
import com.structurizr.export.plantuml.StructurizrPlantUMLExporter;
import com.structurizr.export.structurizr.StructurizrDslExporter;
import com.structurizr.model.*;
import com.structurizr.view.*;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class C4ModelExtractor {

    private static final String BASE_PKG = "org.springframework.samples.petclinic";
    private static final Path DOCS_DIR   = Paths.get("docs");
    private static final Path VIEWS_DIR  = DOCS_DIR.resolve("views");

    private record ComponentGroup(String name, String description, String technology, List<String> packages) {}

    private static final List<ComponentGroup> GROUPS = List.of(
        new ComponentGroup("REST Layer",       "HTTP endpoints, DTOs, error handlers", "Spring MVC",
            List.of(BASE_PKG + ".rest", BASE_PKG + ".rest.dto", BASE_PKG + ".rest.error")),
        new ComponentGroup("Domain Model",     "JPA entities",                         "JPA",
            List.of(BASE_PKG + ".model")),
        new ComponentGroup("Repository Layer", "Spring Data JPA repositories",         "Spring Data",
            List.of(BASE_PKG + ".repository")),
        new ComponentGroup("Mapper Layer",     "MapStruct mappers",                    "MapStruct",
            List.of(BASE_PKG + ".mapper")),
        new ComponentGroup("Security",         "Spring Security configuration",        "Spring Security",
            List.of(BASE_PKG + ".security")),
        new ComponentGroup("Invoice",          "Invoice processing logic",             "Java",
            List.of(BASE_PKG + ".invoice")),
        new ComponentGroup("Utilities",        "Cross-cutting utilities",              "Java",
            List.of(BASE_PKG + ".util"))
    );

    @Test
    void generateC4Model() throws IOException {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PKG);

        Workspace workspace = buildWorkspace(classes);

        Files.createDirectories(VIEWS_DIR);
        exportDsl(workspace);
        exportPlantUmlViews(workspace);

        assertThat(DOCS_DIR.resolve("C4 model.dsl")).exists();
        assertThat(VIEWS_DIR.resolve("container-view.puml")).exists();
        assertThat(VIEWS_DIR.resolve("component-view.puml")).exists();
    }

    private Workspace buildWorkspace(JavaClasses classes) {
        return null; // TODO
    }

    private void exportDsl(Workspace workspace) throws IOException {
        // TODO
    }

    private void exportPlantUmlViews(Workspace workspace) throws IOException {
        // TODO
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd petclinic-backend
mvn test -Dtest=C4ModelExtractor -q 2>&1 | tail -10
```

Expected: test fails with `AssertionError` — `buildWorkspace` returns null, export methods are no-ops, so no files are created.

---

### Task 3: Implement the Workspace Builder

**Files:**
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/architecture/C4ModelExtractor.java`

- [ ] **Step 1: Replace `buildWorkspace()` with full implementation**

```java
private Workspace buildWorkspace(JavaClasses classes) {
    Workspace workspace = new Workspace("PetClinic", "Veterinary practice management system");
    Model model = workspace.getModel();
    ViewSet views = workspace.getViews();

    // Persons
    Person petOwner     = model.addPerson("Pet Owner",     "Manages their pets and appointments");
    Person veterinarian = model.addPerson("Veterinarian",  "Provides veterinary care");

    // Software system
    SoftwareSystem petClinic = model.addSoftwareSystem("PetClinic", "Veterinary practice management system");
    petOwner.uses(petClinic,     "Manages pets and visits");
    veterinarian.uses(petClinic, "Manages appointments and records");

    // Containers
    Container frontend = petClinic.addContainer("Frontend",  "Single-page application", "React");
    Container backend  = petClinic.addContainer("Backend",   "REST API",                "Java / Spring Boot");
    Container database = petClinic.addContainer("Database",  "Stores all data",         "H2 / PostgreSQL");

    petOwner.uses(frontend,     "Uses");
    veterinarian.uses(frontend, "Uses");
    frontend.uses(backend,  "REST API calls",     "HTTPS/JSON");
    backend.uses(database, "Reads/writes data",  "JPA");

    // Auto-extracted components
    Map<String, Component> componentMap = extractComponents(backend, classes);
    addDependencies(classes, componentMap);

    // Container view: persons + all containers
    ContainerView containerView = views.createContainerView(petClinic, "container-view", "Container view");
    containerView.addAllPeople();
    containerView.addAllContainers();
    containerView.enableAutomaticLayout();

    // Component view: all components inside Backend
    ComponentView componentView = views.createComponentView(backend, "component-view", "Component view");
    componentView.addAllComponents();
    componentView.enableAutomaticLayout();

    return workspace;
}
```

- [ ] **Step 2: Add `extractComponents()` method**

```java
private Map<String, Component> extractComponents(Container backend, JavaClasses classes) {
    Map<String, Component> componentMap = new LinkedHashMap<>();
    for (ComponentGroup group : GROUPS) {
        boolean hasClasses = classes.stream()
            .anyMatch(c -> group.packages().contains(c.getPackageName()));
        if (hasClasses) {
            componentMap.put(group.name(),
                backend.addComponent(group.name(), group.description(), group.technology()));
        }
    }
    return componentMap;
}
```

- [ ] **Step 3: Add `addDependencies()` method**

```java
private void addDependencies(JavaClasses classes, Map<String, Component> componentMap) {
    Map<String, String> packageToGroup = new HashMap<>();
    for (ComponentGroup group : GROUPS) {
        for (String pkg : group.packages()) {
            packageToGroup.put(pkg, group.name());
        }
    }

    Set<String> added = new HashSet<>();
    for (JavaClass javaClass : classes) {
        String sourceGroup = packageToGroup.get(javaClass.getPackageName());
        if (sourceGroup == null) continue;
        Component sourceComp = componentMap.get(sourceGroup);

        for (Dependency dep : javaClass.getDirectDependenciesFromSelf()) {
            String targetGroup = packageToGroup.get(dep.getTargetClass().getPackageName());
            if (targetGroup == null || targetGroup.equals(sourceGroup)) continue;
            Component targetComp = componentMap.get(targetGroup);

            String key = sourceGroup + "->" + targetGroup;
            if (added.add(key)) {
                sourceComp.uses(targetComp, "");
            }
        }
    }
}
```

- [ ] **Step 4: Verify test still fails (exports not yet implemented)**

```bash
cd petclinic-backend
mvn test -Dtest=C4ModelExtractor -q 2>&1 | tail -10
```

Expected: test fails with an assertion error about missing files (workspace now builds correctly, but nothing has been written yet).

---

### Task 4: Implement Exports and Verify

**Files:**
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/architecture/C4ModelExtractor.java`
- Created (generated): `petclinic-backend/docs/C4 model.dsl`
- Created (generated): `petclinic-backend/docs/views/container-view.puml`
- Created (generated): `petclinic-backend/docs/views/component-view.puml`

- [ ] **Step 1: Replace `exportDsl()` with implementation**

```java
private void exportDsl(Workspace workspace) throws IOException {
    String dsl = new StructurizrDslExporter().export(workspace);
    Files.writeString(DOCS_DIR.resolve("C4 model.dsl"), dsl);
}
```

- [ ] **Step 2: Replace `exportPlantUmlViews()` with implementation**

```java
private void exportPlantUmlViews(Workspace workspace) throws IOException {
    for (Diagram diagram : new StructurizrPlantUMLExporter().export(workspace)) {
        Files.writeString(VIEWS_DIR.resolve(diagram.getKey() + ".puml"), diagram.getDefinition());
    }
}
```

- [ ] **Step 3: Run test — expect it to pass**

```bash
cd petclinic-backend
mvn test -Dtest=C4ModelExtractor
```

Expected: `BUILD SUCCESS`. Three output files are created.

- [ ] **Step 4: Inspect the generated files**

```bash
cd petclinic-backend
head -40 docs/"C4 model.dsl"
echo "---"
head -20 docs/views/container-view.puml
echo "---"
head -20 docs/views/component-view.puml
```

Confirm:
- DSL starts with `workspace "PetClinic"` and contains a `views {` block with `container` and `component` entries
- Each `.puml` starts with `@startuml` and ends with `@enduml`

- [ ] **Step 5: Commit everything**

```bash
cd petclinic-backend
git add pom.xml \
        src/test/java/org/springframework/samples/petclinic/architecture/C4ModelExtractor.java \
        docs/"C4 model.dsl" \
        docs/views/container-view.puml \
        docs/views/component-view.puml
git commit -m "feat: add Structurizr C4 model extractor with container and component views"
```
