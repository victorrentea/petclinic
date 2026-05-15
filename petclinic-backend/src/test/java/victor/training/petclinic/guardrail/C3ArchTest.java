package victor.training.petclinic.guardrail;

import com.structurizr.Workspace;
import com.structurizr.dsl.StructurizrDslParser;
import com.structurizr.export.Diagram;
import com.structurizr.export.plantuml.C4PlantUMLExporter;
import com.structurizr.model.Component;
import com.structurizr.model.Container;
import com.structurizr.model.Relationship;
import com.structurizr.model.SoftwareSystem;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

class C3ArchTest {

    private static final String BASE_PKG = "victor.training.petclinic";
    private static final Path DSL_FILE   = Paths.get("docs/c4.dsl");
    private static final Path VIEWS_DIR  = Paths.get("docs/generated/c4views");
    private static final String BACKEND_CONTAINER = "Backend";

    private static Workspace workspace;
    private static Container backend;
    private static Map<String, Component> componentByPackage;
    private static JavaClasses classes;

    @BeforeAll
    static void loadModel() throws Exception {
        StructurizrDslParser parser = new StructurizrDslParser();
        parser.parse(new File(DSL_FILE.toString()));
        workspace = parser.getWorkspace();

        SoftwareSystem petClinic = workspace.getModel().getSoftwareSystems().iterator().next();
        backend = petClinic.getContainerWithName(BACKEND_CONTAINER);
        assertThat(backend).as("DSL must declare a '%s' container", BACKEND_CONTAINER).isNotNull();

        componentByPackage = new LinkedHashMap<>();
        for (Component comp : backend.getComponents()) {
            String packagesProp = comp.getProperties().get("packages");
            assertThat(packagesProp)
                .as("Component '%s' must declare a 'packages' property in the DSL", comp.getName())
                .isNotBlank();
            for (String pkg : packagesProp.split(",")) {
                String fullPkg = BASE_PKG + "." + pkg.trim();
                Component prev = componentByPackage.put(fullPkg, comp);
                assertThat(prev)
                    .as("Package '%s' is mapped to both '%s' and '%s'", fullPkg, prev == null ? "" : prev.getName(), comp.getName())
                    .isNull();
            }
        }

        classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PKG);
    }

    @Test
    void everyCodePackageIsMappedToAComponent() {
        Set<String> codePackages = new TreeSet<>();
        for (JavaClass jc : classes) {
            if (jc.getPackageName().startsWith(BASE_PKG) && !jc.getPackageName().equals(BASE_PKG)) {
                codePackages.add(jc.getPackageName());
            }
        }
        Set<String> orphans = new TreeSet<>();
        for (String pkg : codePackages) {
            if (!componentByPackage.containsKey(pkg)) orphans.add(pkg);
        }
        assertThat(orphans)
            .as("Code packages not declared on any component in %s — add them to a `properties { packages \"...\" }`", DSL_FILE)
            .isEmpty();
    }

    @Test
    void everyDeclaredComponentPackageExistsInCode() {
        Set<String> codePackages = new TreeSet<>();
        for (JavaClass jc : classes) codePackages.add(jc.getPackageName());

        Set<String> phantom = new TreeSet<>();
        for (String pkg : componentByPackage.keySet()) {
            if (!codePackages.contains(pkg)) phantom.add(pkg);
        }
        assertThat(phantom)
            .as("Packages declared in %s but absent from the codebase — remove them or create the package", DSL_FILE)
            .isEmpty();
    }

    @Test
    void componentEdgesInDslMatchActualCodeDependencies() {
        Set<String> declaredEdges = new TreeSet<>();
        for (Relationship rel : workspace.getModel().getRelationships()) {
            if (rel.getSource() instanceof Component src && rel.getDestination() instanceof Component dst) {
                declaredEdges.add(src.getName() + " -> " + dst.getName());
            }
        }

        Set<String> actualEdges = new TreeSet<>();
        for (JavaClass jc : classes) {
            Component srcComp = componentByPackage.get(jc.getPackageName());
            if (srcComp == null) continue;
            for (Dependency dep : jc.getDirectDependenciesFromSelf()) {
                Component dstComp = componentByPackage.get(dep.getTargetClass().getPackageName());
                if (dstComp == null || dstComp == srcComp) continue;
                actualEdges.add(srcComp.getName() + " -> " + dstComp.getName());
            }
        }

        Set<String> missingInDsl = new TreeSet<>(actualEdges);
        missingInDsl.removeAll(declaredEdges);
        Set<String> phantomInDsl = new TreeSet<>(declaredEdges);
        phantomInDsl.removeAll(actualEdges);

        assertThat(missingInDsl)
            .as("Code has component dependencies not declared in %s — add them as `src -> dst \"\"`", DSL_FILE)
            .isEmpty();
        assertThat(phantomInDsl)
            .as("DSL declares component dependencies absent from the code — remove them from %s", DSL_FILE)
            .isEmpty();
    }

    @Test
    void exportPlantUmlDiagrams() throws Exception {
        Files.createDirectories(VIEWS_DIR);
        for (Diagram diagram : new C4PlantUMLExporter().export(workspace)) {
            Files.writeString(VIEWS_DIR.resolve(diagram.getKey() + ".puml"), diagram.getDefinition());
        }
        assertThat(VIEWS_DIR).isNotEmptyDirectory();
    }
}
