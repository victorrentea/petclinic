package org.springframework.samples.petclinic.architecture;

import com.structurizr.Workspace;
import com.structurizr.export.Diagram;
import com.structurizr.export.plantuml.StructurizrPlantUMLExporter;
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

        SoftwareSystem petClinic = workspace.getModel().getSoftwareSystems().stream()
            .filter(s -> s.getName().equals("PetClinic")).findFirst().orElseThrow();
        Container backend = petClinic.getContainers().stream()
            .filter(c -> c.getName().equals("Backend")).findFirst().orElseThrow();

        Files.createDirectories(VIEWS_DIR);
        exportDsl(workspace, petClinic, backend);
        exportPlantUmlViews(workspace);

        assertThat(DOCS_DIR.resolve("C4 model.dsl")).exists();
        assertThat(VIEWS_DIR.resolve("container-view.puml")).exists();
        assertThat(VIEWS_DIR.resolve("component-view.puml")).exists();
        assertThat(VIEWS_DIR.resolve("repository-layer-view.puml")).exists();
    }

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

        configureViews(views, petClinic, backend);

        return workspace;
    }

    private void configureViews(ViewSet views, SoftwareSystem petClinic, Container backend) {
        // Container view: persons + all containers
        ContainerView containerView = views.createContainerView(petClinic, "container-view", "Container view");
        containerView.addAllPeople();
        containerView.addAllContainers();
        containerView.enableAutomaticLayout();

        // Component view: all components inside Backend
        ComponentView componentView = views.createComponentView(backend, "component-view", "Component view");
        componentView.addAllComponents();
        componentView.enableAutomaticLayout();

        // Repository layer focused view: repo layer + direct neighbours (callers and callees)
        backend.getComponents().stream()
            .filter(c -> c.getName().equals("Repository Layer"))
            .findFirst()
            .ifPresent(repoLayer -> {
                ComponentView repoView = views.createComponentView(backend, "repository-layer-view", "Repository layer dependencies");
                repoView.addNearestNeighbours(repoLayer);
                repoView.enableAutomaticLayout();
            });
    }

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

    /**
     * Generates a Structurizr DSL representation of the workspace.
     * Note: structurizr-export 6.1.0 does not include a StructurizrDslExporter,
     * so we hand-craft the DSL output from the workspace model.
     */
    private void exportDsl(Workspace workspace, SoftwareSystem petClinic, Container backend) throws IOException {
        Model model = workspace.getModel();
        StringBuilder sb = new StringBuilder();

        sb.append("workspace \"").append(workspace.getName()).append("\" \"").append(workspace.getDescription()).append("\" {\n\n");
        sb.append("    model {\n");

        // Persons
        for (Person person : model.getPeople()) {
            sb.append("        ").append(sanitizeId(person.getName()))
              .append(" = person \"").append(person.getName()).append("\" \"").append(person.getDescription()).append("\"\n");
        }

        // Software systems
        for (SoftwareSystem system : model.getSoftwareSystems()) {
            sb.append("        ").append(sanitizeId(system.getName()))
              .append(" = softwareSystem \"").append(system.getName()).append("\" \"").append(system.getDescription()).append("\" {\n");

            for (Container container : system.getContainers()) {
                sb.append("            ").append(sanitizeId(container.getName()))
                  .append(" = container \"").append(container.getName())
                  .append("\" \"").append(container.getDescription())
                  .append("\" \"").append(container.getTechnology()).append("\" {\n");

                for (Component component : container.getComponents()) {
                    sb.append("                ").append(sanitizeId(component.getName()))
                      .append(" = component \"").append(component.getName())
                      .append("\" \"").append(component.getDescription())
                      .append("\" \"").append(component.getTechnology()).append("\"\n");
                }
                sb.append("            }\n");
            }
            sb.append("        }\n");
        }

        // Relationships
        sb.append("\n");
        for (Relationship rel : model.getRelationships()) {
            sb.append("        ").append(sanitizeId(rel.getSource().getName()))
              .append(" -> ").append(sanitizeId(rel.getDestination().getName()))
              .append(" \"").append(rel.getDescription()).append("\"");
            if (rel.getTechnology() != null && !rel.getTechnology().isEmpty()) {
                sb.append(" \"").append(rel.getTechnology()).append("\"");
            }
            sb.append("\n");
        }

        sb.append("    }\n\n");
        sb.append("    views {\n");
        sb.append("        container ").append(sanitizeId(petClinic.getName())).append(" {\n");
        sb.append("            include *\n");
        sb.append("            autoLayout\n");
        sb.append("        }\n");
        sb.append("        component ").append(sanitizeId(backend.getName())).append(" {\n");
        sb.append("            include *\n");
        sb.append("            autoLayout\n");
        sb.append("        }\n");

        sb.append("        component ").append(sanitizeId(backend.getName()))
          .append(" \"repository-layer-view\" \"Repository layer dependencies\" {\n");
        sb.append("            include ->").append(sanitizeId("Repository Layer")).append("->\n");
        sb.append("            autoLayout\n");
        sb.append("        }\n");

        sb.append("    }\n");
        sb.append("}\n");

        Files.writeString(DOCS_DIR.resolve("C4 model.dsl"), sb.toString());
    }

    private String sanitizeId(String name) {
        return name.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
    }

    private void exportPlantUmlViews(Workspace workspace) throws IOException {
        for (Diagram diagram : new StructurizrPlantUMLExporter().export(workspace)) {
            Files.writeString(VIEWS_DIR.resolve(diagram.getKey() + ".puml"), diagram.getDefinition());
        }
    }
}
