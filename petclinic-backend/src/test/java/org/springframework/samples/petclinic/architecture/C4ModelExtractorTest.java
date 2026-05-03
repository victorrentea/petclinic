package org.springframework.samples.petclinic.architecture;

import com.structurizr.Workspace;
import com.structurizr.export.Diagram;
import com.structurizr.export.plantuml.C4PlantUMLExporter;
import com.structurizr.model.*;
import com.structurizr.view.*;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import net.sourceforge.plantuml.FileFormat;
import net.sourceforge.plantuml.FileFormatOption;
import net.sourceforge.plantuml.SourceStringReader;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class C4ModelExtractorTest {

    // ── Project-specific config ───────────────────────────────────────────────
    private static final String BASE_PKG       = "org.springframework.samples.petclinic";
    private static final String WORKSPACE_NAME = "PetClinic";
    private static final String WORKSPACE_DESC = "Veterinary practice management system";

    private record ComponentGroup(String name, String description, String technology, String color, List<String> packages) {}

    private static final List<ComponentGroup> GROUPS = List.of(
        new ComponentGroup("REST Layer",       "HTTP endpoints, DTOs, error handlers", "Spring MVC",     "#1168bd", List.of(BASE_PKG + ".rest", BASE_PKG + ".rest.dto", BASE_PKG + ".rest.error")),
        new ComponentGroup("Domain Model",     "JPA entities",                         "JPA",            "#999999", List.of(BASE_PKG + ".model")),
        new ComponentGroup("Repository Layer", "Spring Data JPA repositories",         "Spring Data",    "#e8a838", List.of(BASE_PKG + ".repository")),
        new ComponentGroup("Mapper Layer",     "MapStruct mappers",                    "MapStruct",      "#4caf50", List.of(BASE_PKG + ".mapper")),
        new ComponentGroup("Security",         "Spring Security configuration",        "Spring Security","#888888", List.of(BASE_PKG + ".security")),
        new ComponentGroup("Invoice",          "Invoice processing logic",             "Java",           "#c0392b", List.of(BASE_PKG + ".invoice")),
        new ComponentGroup("Utilities",        "Cross-cutting utilities",              "Java",           "#888888", List.of(BASE_PKG + ".util"))
    );

    // Components that get a dedicated focused view showing their nearest neighbours
    private static final List<String> FOCUSED_VIEWS = List.of("Repository Layer", "Mapper Layer");

    // ─────────────────────────────────────────────────────────────────────────

    private static final Path DOCS_DIR      = Paths.get("docs");
    private static final Path GENERATED_DIR = DOCS_DIR.resolve("generated");
    private static final Path VIEWS_DIR     = GENERATED_DIR.resolve("c4views");

    @Test
    void generateC4Model() throws IOException {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PKG);

        assertAllPackagesCovered(classes);

        Workspace workspace = buildWorkspace(classes);
        Files.createDirectories(VIEWS_DIR);
        exportDsl(workspace);
        exportDiagrams(workspace);

        assertThat(GENERATED_DIR.resolve("C4.dsl")).exists();
        assertThat(VIEWS_DIR).isNotEmptyDirectory();
    }

    private Workspace buildWorkspace(JavaClasses classes) {
        Workspace workspace = new Workspace(WORKSPACE_NAME, WORKSPACE_DESC);
        Model model = workspace.getModel();

        Person petOwner     = model.addPerson("Pet Owner",    "Manages their pets and appointments");
        Person veterinarian = model.addPerson("Veterinarian", "Provides veterinary care");

        SoftwareSystem petClinic = model.addSoftwareSystem(WORKSPACE_NAME, WORKSPACE_DESC);
        petOwner.uses(petClinic,     "Manages pets and visits");
        veterinarian.uses(petClinic, "Manages appointments and records");

        Container frontend = petClinic.addContainer("Frontend", "Single-page application", "React");
        Container backend  = petClinic.addContainer("Backend",  "REST API",                "Java / Spring Boot");
        Container database = petClinic.addContainer("Database", "Stores all data",         "H2 / PostgreSQL");

        petOwner.uses(frontend,     "Uses");
        veterinarian.uses(frontend, "Uses");
        frontend.uses(backend,  "REST API calls", "HTTPS/JSON");
        backend.uses(database,  "Reads/writes",   "JPA");

        Map<String, Component> componentMap = extractComponents(backend, classes);
        addDependencies(classes, componentMap);
        configureViews(workspace.getViews(), petClinic, backend);
        addStyles(workspace.getViews().getConfiguration().getStyles());

        return workspace;
    }

    private void assertAllPackagesCovered(JavaClasses classes) {
        Set<String> coveredPackages = new HashSet<>();
        for (ComponentGroup group : GROUPS) coveredPackages.addAll(group.packages());

        Set<String> uncovered = new TreeSet<>();
        for (JavaClass javaClass : classes) {
            String pkg = javaClass.getPackageName();
            if (pkg.startsWith(BASE_PKG) && !pkg.equals(BASE_PKG) && coveredPackages.stream().noneMatch(pkg::startsWith)) {
                uncovered.add(pkg);
            }
        }
        assertThat(uncovered)
            .as("Packages not mapped in GROUPS — add them or extend an existing entry")
            .isEmpty();
    }

    private Map<String, Component> extractComponents(Container backend, JavaClasses classes) {
        Map<String, Component> componentMap = new LinkedHashMap<>();
        for (ComponentGroup group : GROUPS) {
            boolean hasClasses = classes.stream().anyMatch(c -> group.packages().contains(c.getPackageName()));
            if (hasClasses) {
                Component comp = backend.addComponent(group.name(), group.description(), group.technology());
                comp.addTags(group.name());
                componentMap.put(group.name(), comp);
            }
        }
        return componentMap;
    }

    private void addDependencies(JavaClasses classes, Map<String, Component> componentMap) {
        Map<String, String> packageToGroup = new HashMap<>();
        for (ComponentGroup group : GROUPS) {
            for (String pkg : group.packages()) packageToGroup.put(pkg, group.name());
        }
        Set<String> added = new HashSet<>();
        for (JavaClass javaClass : classes) {
            String sourceGroup = packageToGroup.get(javaClass.getPackageName());
            if (sourceGroup == null) continue;
            Component sourceComp = componentMap.get(sourceGroup);
            for (Dependency dep : javaClass.getDirectDependenciesFromSelf()) {
                String targetGroup = packageToGroup.get(dep.getTargetClass().getPackageName());
                if (targetGroup == null || targetGroup.equals(sourceGroup)) continue;
                if (added.add(sourceGroup + "->" + targetGroup)) {
                    sourceComp.uses(componentMap.get(targetGroup), "");
                }
            }
        }
    }

    private void configureViews(ViewSet views, SoftwareSystem petClinic, Container backend) {
        SystemContextView ctxView = views.createSystemContextView(petClinic, "C1-Context", "Who uses " + WORKSPACE_NAME);
        ctxView.addAllElements();
        ctxView.enableAutomaticLayout();

        ContainerView containerView = views.createContainerView(petClinic, "C2-Containers", "Containers inside " + WORKSPACE_NAME);
        containerView.addAllPeople();
        containerView.addAllContainers();
        containerView.enableAutomaticLayout();

        ComponentView componentView = views.createComponentView(backend, "C3-Components-All", "All components inside Backend");
        componentView.addAllComponents();
        componentView.enableAutomaticLayout();

        for (String focusedName : FOCUSED_VIEWS) {
            backend.getComponents().stream()
                .filter(c -> c.getName().equals(focusedName))
                .findFirst()
                .ifPresent(comp -> {
                    ComponentView focusView = views.createComponentView(backend,
                        "C3-" + focusedName.split(" ")[0], focusedName + " — nearest neighbours");
                    focusView.addNearestNeighbours(comp);
                    focusView.enableAutomaticLayout();
                });
        }
    }

    private void addStyles(Styles styles) {
        styles.addElementStyle(Tags.PERSON).shape(Shape.Person).background("#08427b").color("#ffffff");
        styles.addElementStyle(Tags.SOFTWARE_SYSTEM).background("#1168bd").color("#ffffff");
        styles.addElementStyle(Tags.CONTAINER).background("#438dd5").color("#ffffff");
        styles.addElementStyle(Tags.COMPONENT).background("#85bbf0").color("#000000");
        for (ComponentGroup group : GROUPS) {
            styles.addElementStyle(group.name()).background(group.color()).color("#ffffff");
        }
    }

    // ── DSL export (hand-crafted: structurizr-export 6.1.0 has no DSL exporter) ──

    private void exportDsl(Workspace workspace) throws IOException {
        Model model = workspace.getModel();
        ViewSet views = workspace.getViews();
        StringBuilder sb = new StringBuilder();

        sb.append("workspace \"").append(workspace.getName()).append("\" \"").append(workspace.getDescription()).append("\" {\n\n");
        sb.append("    model {\n");

        for (Person p : model.getPeople()) {
            sb.append("        ").append(id(p.getName()))
              .append(" = person \"").append(p.getName()).append("\" \"").append(p.getDescription()).append("\"\n");
        }
        for (SoftwareSystem sys : model.getSoftwareSystems()) {
            sb.append("        ").append(id(sys.getName()))
              .append(" = softwareSystem \"").append(sys.getName()).append("\" \"").append(sys.getDescription()).append("\" {\n");
            for (Container ctr : sys.getContainers()) {
                sb.append("            ").append(id(ctr.getName()))
                  .append(" = container \"").append(ctr.getName()).append("\" \"").append(ctr.getDescription())
                  .append("\" \"").append(ctr.getTechnology()).append("\"");
                if (ctr.getComponents().isEmpty()) {
                    sb.append("\n");
                } else {
                    sb.append(" {\n");
                    for (Component comp : ctr.getComponents()) {
                        Set<String> customTags = new LinkedHashSet<>(comp.getTagsAsSet());
                        customTags.removeAll(Set.of("Element", "Component"));
                        sb.append("                ").append(id(comp.getName()))
                          .append(" = component \"").append(comp.getName()).append("\" \"").append(comp.getDescription())
                          .append("\" \"").append(comp.getTechnology()).append("\"");
                        if (!customTags.isEmpty()) {
                            sb.append(" {\n                    tags");
                            customTags.forEach(t -> sb.append(" \"").append(t).append("\""));
                            sb.append("\n                }");
                        }
                        sb.append("\n");
                    }
                    sb.append("            }\n");
                }
            }
            sb.append("        }\n");
        }

        sb.append("\n");
        for (Relationship rel : model.getRelationships()) {
            sb.append("        ").append(id(rel.getSource().getName()))
              .append(" -> ").append(id(rel.getDestination().getName()))
              .append(" \"").append(rel.getDescription()).append("\"");
            if (rel.getTechnology() != null && !rel.getTechnology().isBlank()) {
                sb.append(" \"").append(rel.getTechnology()).append("\"");
            }
            sb.append("\n");
        }

        sb.append("    }\n\n    views {\n");

        for (SystemContextView v : views.getSystemContextViews()) {
            sb.append("        systemContext ").append(id(v.getSoftwareSystem().getName()))
              .append(" \"").append(v.getKey()).append("\" \"").append(v.getDescription()).append("\" {\n")
              .append("            include *\n            autoLayout\n        }\n");
        }
        for (ContainerView v : views.getContainerViews()) {
            sb.append("        container ").append(id(v.getSoftwareSystem().getName()))
              .append(" \"").append(v.getKey()).append("\" \"").append(v.getDescription()).append("\" {\n")
              .append("            include *\n            autoLayout\n        }\n");
        }
        for (ComponentView v : views.getComponentViews()) {
            sb.append("        component ").append(id(v.getContainer().getName()))
              .append(" \"").append(v.getKey()).append("\" \"").append(v.getDescription()).append("\" {\n");
            long componentCount = v.getElements().stream().filter(e -> e.getElement() instanceof Component).count();
            if (componentCount == v.getContainer().getComponents().size()) {
                sb.append("            include *\n");
            } else {
                v.getElements().stream()
                    .filter(e -> e.getElement() instanceof Component)
                    .forEach(e -> sb.append("            include ").append(id(e.getElement().getName())).append("\n"));
            }
            sb.append("            autoLayout\n        }\n");
        }

        sb.append("\n        styles {\n");
        for (ElementStyle style : views.getConfiguration().getStyles().getElements()) {
            sb.append("            element \"").append(style.getTag()).append("\" {\n");
            if (style.getShape()      != null) sb.append("                shape ").append(style.getShape()).append("\n");
            if (style.getBackground() != null) sb.append("                background ").append(style.getBackground()).append("\n");
            if (style.getColor()      != null) sb.append("                color ").append(style.getColor()).append("\n");
            sb.append("            }\n");
        }
        sb.append("        }\n    }\n}\n");

        Files.writeString(GENERATED_DIR.resolve("C4.dsl"), sb.toString());
    }

    private void exportDiagrams(Workspace workspace) throws IOException {
        FileFormatOption svg = new FileFormatOption(FileFormat.SVG);
        for (Diagram diagram : new C4PlantUMLExporter().export(workspace)) {
            String puml = diagram.getDefinition();
            Files.writeString(VIEWS_DIR.resolve(diagram.getKey() + ".puml"), puml);
            try (OutputStream os = Files.newOutputStream(VIEWS_DIR.resolve(diagram.getKey() + ".svg"))) {
                new SourceStringReader(puml).outputImage(os, svg);
            }
        }
    }

    private String id(String name) {
        return name.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
    }
}
