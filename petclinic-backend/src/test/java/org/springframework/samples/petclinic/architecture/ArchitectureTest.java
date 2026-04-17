package org.springframework.samples.petclinic.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import java.nio.file.Paths;

import static com.tngtech.archunit.library.plantuml.rules.PlantUmlArchCondition.Configuration.consideringOnlyDependenciesInAnyPackage;
import static com.tngtech.archunit.library.plantuml.rules.PlantUmlArchCondition.adhereToPlantUmlDiagram;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

@AnalyzeClasses(
    packages = {
        "org.springframework.samples.petclinic.model",
        "org.springframework.samples.petclinic.repository",
        "org.springframework.samples.petclinic.mapper",
        "org.springframework.samples.petclinic.rest",
        "org.springframework.samples.petclinic.rest.dto",
        "org.springframework.samples.petclinic.rest.error",
        "org.springframework.samples.petclinic.invoice",
        "org.springframework.samples.petclinic.security",
        "org.springframework.samples.petclinic.util"
    },
    importOptions = ImportOption.DoNotIncludeTests.class
)
class ArchitectureTest {

    private static final java.net.URL DIAGRAM = diagramUrl();

    private static java.net.URL diagramUrl() {
        try {
            return Paths.get("docs/architecture.puml").toUri().toURL();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @ArchTest
    static final ArchRule adheresToDiagram =
        classes().should(adhereToPlantUmlDiagram(
            DIAGRAM,
            consideringOnlyDependenciesInAnyPackage("org.springframework.samples.petclinic..")
        ));
}
