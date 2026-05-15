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
    private static Map<Component, String> patternByComponent;
    private static JavaClasses classes;

    @BeforeAll
    static void loadModel() throws Exception {
        StructurizrDslParser parser = new StructurizrDslParser();
        parser.parse(new File(DSL_FILE.toString()));
        workspace = parser.getWorkspace();

        SoftwareSystem petClinic = workspace.getModel().getSoftwareSystems().iterator().next();
        backend = petClinic.getContainerWithName(BACKEND_CONTAINER);
        assertThat(backend).as("DSL must declare a '%s' container", BACKEND_CONTAINER).isNotNull();

        patternByComponent = new LinkedHashMap<>();
        for (Component comp : backend.getComponents()) {
            String pattern = comp.getProperties().get("package");
            assertThat(pattern)
                .as("Component '%s' must declare a `properties { \"package\" \"...\" }` block in the DSL", comp.getName())
                .isNotBlank();
            patternByComponent.put(comp, pattern.trim());
        }

        classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PKG);
    }

    private static Component resolveComponent(String fullyQualifiedPackage) {
        if (!fullyQualifiedPackage.startsWith(BASE_PKG + ".")) return null;
        String relative = fullyQualifiedPackage.substring(BASE_PKG.length() + 1);
        Component best = null;
        int bestLen = -1;
        for (Map.Entry<Component, String> e : patternByComponent.entrySet()) {
            String pattern = e.getValue();
            String prefix = pattern.endsWith(".**") ? pattern.substring(0, pattern.length() - 3) : pattern;
            boolean matches = pattern.endsWith(".**")
                ? relative.equals(prefix) || relative.startsWith(prefix + ".")
                : relative.equals(prefix);
            if (matches && prefix.length() > bestLen) {
                best = e.getKey();
                bestLen = prefix.length();
            }
        }
        return best;
    }

    @Test
    void everyCodePackageIsMappedToAComponent() {
        Set<String> orphans = new TreeSet<>();
        for (JavaClass jc : classes) {
            String pkg = jc.getPackageName();
            if (!pkg.startsWith(BASE_PKG) || pkg.equals(BASE_PKG)) continue;
            if (resolveComponent(pkg) == null) orphans.add(pkg);
        }
        assertThat(orphans)
            .as("Code packages not matched by any component's `package` pattern in %s", DSL_FILE)
            .isEmpty();
    }

    @Test
    void everyDeclaredComponentPatternMatchesAtLeastOneCodePackage() {
        Set<String> codePackages = new TreeSet<>();
        for (JavaClass jc : classes) codePackages.add(jc.getPackageName());

        Set<String> phantom = new TreeSet<>();
        for (Map.Entry<Component, String> e : patternByComponent.entrySet()) {
            boolean hasMatch = codePackages.stream().anyMatch(p -> resolveComponent(p) == e.getKey());
            if (!hasMatch) phantom.add(e.getKey().getName() + " (" + e.getValue() + ")");
        }
        assertThat(phantom)
            .as("Components declared in %s but no code package matches their `package` pattern", DSL_FILE)
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
            Component srcComp = resolveComponent(jc.getPackageName());
            if (srcComp == null) continue;
            for (Dependency dep : jc.getDirectDependenciesFromSelf()) {
                Component dstComp = resolveComponent(dep.getTargetClass().getPackageName());
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
