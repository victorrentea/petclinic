package org.springframework.samples.petclinic;

import com.structurizr.Workspace;
import com.structurizr.component.ComponentFinder;
import com.structurizr.component.ComponentFinderBuilder;
import com.structurizr.component.ComponentFinderStrategyBuilder;
import com.structurizr.component.filter.IncludeFullyQualifiedNameRegexFilter;
import com.structurizr.component.matcher.AnnotationTypeMatcher;
import com.structurizr.component.matcher.NameSuffixTypeMatcher;
import com.structurizr.export.plantuml.C4PlantUMLExporter;
import com.structurizr.model.*;
import com.structurizr.view.*;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.util.Collection;
import java.util.stream.Collectors;

public class C4ModelExtractor {

    static final String BASE_PACKAGE = "org\\.springframework\\.samples\\.petclinic\\..*";
    static final File CLASSES_DIR = new File("target/classes");
    static final File SOURCE_DIR = new File("src/main/java");
    static final File PUML_FILE = new File("../docs/c3-components-backend.puml");
    static final File DSL_FILE  = new File("../docs/workspace.dsl");

    @Test
    void extractAndExport() throws Exception {
        Workspace workspace = new Workspace("PetClinic", "Auto-extracted C4 model");
        Model model = workspace.getModel();

        Person clinicEmployee = model.addPerson("Clinic Employee");
        SoftwareSystem petClinic = model.addSoftwareSystem("PetClinic");
        Container frontend = petClinic.addContainer("Angular SPA", "Single Page App", "Angular 16");
        Container api = petClinic.addContainer("Spring Boot API", "REST backend", "Spring Boot 3.5");
        Container db = petClinic.addContainer("Database", "Persistence", "H2 / PostgreSQL");

        clinicEmployee.uses(frontend, "Uses", "Browser");
        frontend.uses(api, "Calls", "JSON/HTTP");

        ComponentFinder finder = new ComponentFinderBuilder()
            .forContainer(api)
            .fromClasses(CLASSES_DIR)
            .fromSource(SOURCE_DIR)
            .filteredBy(new IncludeFullyQualifiedNameRegexFilter(BASE_PACKAGE))
            .withStrategy(new ComponentFinderStrategyBuilder()
                .matchedBy(new AnnotationTypeMatcher(
                    "org.springframework.web.bind.annotation.RestController"))
                .withTechnology("Spring MVC")
                .forEach(c -> frontend.uses(c, "calls", "JSON/HTTP"))
                .build())
            .withStrategy(new ComponentFinderStrategyBuilder()
                .matchedBy(new NameSuffixTypeMatcher("Mapper"))
                .withTechnology("MapStruct")
                .build())
            .withStrategy(new ComponentFinderStrategyBuilder()
                .matchedBy(new NameSuffixTypeMatcher("Repository"))
                .withTechnology("Spring Data JPA")
                .forEach(c -> c.uses(db, "reads/writes", "JPA"))
                .build())
            .build();

        finder.run();

        Collection<Component> components = api.getComponents();
        System.out.println("Discovered " + components.size() + " components:");
        components.forEach(c -> System.out.printf("  [%-20s] %s%n", c.getTechnology(), c.getName()));

        // Build component view
        ViewSet views = workspace.getViews();
        ComponentView view = views.createComponentView(api, "Components", "Component diagram for the Spring Boot API");
        view.addAllComponents();
        view.add(frontend);
        view.add(db);

        // Export to C4-PlantUML
        C4PlantUMLExporter exporter = new C4PlantUMLExporter();
        String puml = exporter.export(view).getDefinition();
        Files.writeString(PUML_FILE.toPath(), puml);
        System.out.println("Written: " + PUML_FILE.getAbsolutePath());

        // Export to Structurizr DSL
        Files.writeString(DSL_FILE.toPath(), toDsl(workspace));
        System.out.println("Written: " + DSL_FILE.getAbsolutePath());
    }

    private String toDsl(Workspace workspace) {
        Model model = workspace.getModel();
        StringBuilder sb = new StringBuilder();
        sb.append("workspace \"").append(workspace.getName()).append("\" {\n\n");
        sb.append("    model {\n");

        for (Person p : model.getPeople()) {
            sb.append("        ").append(dslId(p.getName()))
              .append(" = person \"").append(p.getName()).append("\"\n");
        }

        for (SoftwareSystem sys : model.getSoftwareSystems()) {
            sb.append("        ").append(dslId(sys.getName()))
              .append(" = softwareSystem \"").append(sys.getName()).append("\" {\n");

            for (Container c : sys.getContainers()) {
                sb.append("            ").append(dslId(c.getName()))
                  .append(" = container \"").append(c.getName()).append("\" \"")
                  .append(c.getDescription()).append("\" \"").append(c.getTechnology()).append("\"");

                if (!c.getComponents().isEmpty()) {
                    sb.append(" {\n");
                    for (Component comp : c.getComponents()) {
                        sb.append("                ").append(dslId(comp.getName()))
                          .append(" = component \"").append(comp.getName()).append("\" \"")
                          .append(nullToEmpty(comp.getDescription())).append("\" \"").append(comp.getTechnology()).append("\"\n");
                    }
                    sb.append("            }\n");
                } else {
                    sb.append("\n");
                }
            }
            sb.append("        }\n");
        }

        sb.append("\n        # Relationships\n");
        model.getRelationships().forEach(r ->
            sb.append("        ").append(dslId(r.getSource().getName()))
              .append(" -> ").append(dslId(r.getDestination().getName()))
              .append(" \"").append(r.getDescription()).append("\"")
              .append(r.getTechnology() != null && !r.getTechnology().isBlank()
                  ? " \"" + r.getTechnology() + "\"" : "")
              .append("\n"));

        sb.append("    }\n\n");
        sb.append("    views {\n");
        sb.append("        # Add your custom views here — all model elements are available above\n\n");

        sb.append("        component ").append(dslId("Spring Boot API")).append(" \"Components\" {\n");
        sb.append("            include *\n");
        sb.append("        }\n\n");

        // Controllers-focused view: each controller + its direct neighbors (callers + callees)
        sb.append("        component ").append(dslId("Spring Boot API")).append(" \"Controllers\" \"REST controllers with their direct dependencies\" {\n");
        for (Component comp : workspace.getModel().getSoftwareSystems().iterator().next()
                .getContainerWithName("Spring Boot API").getComponents()) {
            if ("Spring MVC".equals(comp.getTechnology())) {
                sb.append("            include ->").append(dslId(comp.getName())).append("->\n");
            }
        }
        sb.append("        }\n");

        sb.append("    }\n");
        sb.append("}\n");
        return sb.toString();
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String dslId(String name) {
        return name.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
    }
}
