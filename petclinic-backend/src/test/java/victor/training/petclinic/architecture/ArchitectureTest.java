package victor.training.petclinic.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static com.tngtech.archunit.library.plantuml.rules.PlantUmlArchCondition.Configuration.consideringOnlyDependenciesInAnyPackage;
import static com.tngtech.archunit.library.plantuml.rules.PlantUmlArchCondition.adhereToPlantUmlDiagram;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static org.assertj.core.api.Assertions.assertThat;

@AnalyzeClasses(
    packages = "org.springframework.samples.petclinic",
    importOptions = ImportOption.DoNotIncludeTests.class
)
class ArchitectureTest {

    private static final Path DIAGRAM = Paths.get("docs/packages.puml");
    private static final Path SOURCE_ROOT = Paths.get("src/main/java/org/springframework/samples/petclinic");

    private static java.net.URL url(Path path) {
        try {
            return path.toUri().toURL();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @ArchTest
    static final ArchRule adheresToDiagram =
        classes().should(adhereToPlantUmlDiagram(
            url(DIAGRAM),
            consideringOnlyDependenciesInAnyPackage("..petclinic..")
        ));

    @Test
    void diagramPackagesMatchCodePackages() throws IOException {
        Set<String> diagramPackages = parsePackagesFromDiagram();
        Set<String> codePackages = listCodePackages();

        assertThat(diagramPackages)
            .as("packages.puml stereotypes must match the actual subpackages of org.springframework.samples.petclinic exactly")
            .isEqualTo(codePackages);
    }

    private static Set<String> parsePackagesFromDiagram() throws IOException {
        String puml = Files.readString(DIAGRAM);
        Pattern stereotype = Pattern.compile("<<\\.\\.([a-zA-Z0-9.]+)>>");
        Matcher matcher = stereotype.matcher(puml);
        Set<String> result = new TreeSet<>();
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result;
    }

    private static Set<String> listCodePackages() throws IOException {
        Set<String> result = new TreeSet<>();
        try (Stream<Path> paths = Files.walk(SOURCE_ROOT)) {
            paths.filter(Files::isDirectory)
                .filter(dir -> !dir.equals(SOURCE_ROOT))
                .filter(ArchitectureTest::containsJavaFile)
                .forEach(dir -> result.add(SOURCE_ROOT.relativize(dir).toString().replace('/', '.')));
        }
        return result;
    }

    private static boolean containsJavaFile(Path dir) {
        try (Stream<Path> entries = Files.list(dir)) {
            return entries.anyMatch(p -> p.toString().endsWith(".java"));
        } catch (IOException e) {
            return false;
        }
    }
}
