package org.springframework.samples.petclinic.architecture;

import com.tngtech.archunit.core.domain.*;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Stream;

import static java.util.stream.Collectors.joining;
import static org.assertj.core.api.Assertions.assertThat;

class DomainModelDiagramExtractorTest {

    private static final String BASE_PKG = "org.springframework.samples.petclinic";
    private static final Path VIEWS_DIR = Paths.get("docs/views");

    @Test
    void generateDomainModelDiagram() throws IOException {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(BASE_PKG + ".model");

        Files.createDirectories(VIEWS_DIR);
        generate(classes);

        assertThat(VIEWS_DIR.resolve("domain-model.puml"))
            .exists()
            .content()
            .contains("@startuml")
            .contains("class Owner")
            .contains("class Pet")
            .contains("class Visit")
            .contains("Owner", "Pet")
            .contains("*--")
            .contains("@enduml");
    }

    private void generate(JavaClasses classes) throws IOException {
        List<JavaClass> entities = classes.stream()
            .filter(c -> hasAnnotation(c, "Entity"))
            .sorted(Comparator.comparing(JavaClass::getSimpleName))
            .toList();

        // Which classes are targeted by @OneToMany (to skip redundant @ManyToOne arrows)
        Set<String> coveredByOneToMany = new HashSet<>();
        for (JavaClass clazz : entities) {
            for (JavaField field : clazz.getFields()) {
                if (hasAnnotation(field, "OneToMany")) {
                    String target = collectionElementName(field);
                    if (target != null) coveredByOneToMany.add(target + "->" + clazz.getSimpleName());
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n\n");
        sb.append("skinparam classAttributeIconSize 0\n");
        sb.append("hide empty methods\n\n");

        List<String> relationships = new ArrayList<>();
        Set<String> manyToManyDrawn = new HashSet<>();

        for (JavaClass clazz : entities) {
            sb.append("class ").append(clazz.getSimpleName()).append(" {\n");

            for (JavaField field : clazz.getFields().stream()
                    .filter(f -> !f.getModifiers().contains(JavaModifier.STATIC))
                    .sorted(Comparator.comparing(JavaField::getName))
                    .toList()) {

                if (hasAnnotation(field, "OneToMany")) {
                    String target = collectionElementName(field);
                    if (target != null)
                        relationships.add(clazz.getSimpleName() + " \"1\" *-- \"N\" " + target + " : " + field.getName());

                } else if (hasAnnotation(field, "ManyToMany")) {
                    String target = collectionElementName(field);
                    if (target != null) {
                        String pair = Stream.of(clazz.getSimpleName(), target).sorted().collect(joining("-"));
                        if (manyToManyDrawn.add(pair))
                            relationships.add(clazz.getSimpleName() + " \"N\" -- \"N\" " + target + " : " + field.getName());
                    }

                } else if (hasAnnotation(field, "ManyToOne") || hasAnnotation(field, "OneToOne")) {
                    String target = field.getRawType().getSimpleName();
                    if (!coveredByOneToMany.contains(clazz.getSimpleName() + "->" + target))
                        relationships.add(clazz.getSimpleName() + " --> " + target + " : " + field.getName());

                } else {
                    sb.append("    ").append(field.getRawType().getSimpleName())
                      .append(" ").append(field.getName()).append("\n");
                }
            }
            sb.append("}\n\n");
        }

        relationships.forEach(r -> sb.append(r).append("\n"));
        sb.append("\n@enduml\n");
        Files.writeString(VIEWS_DIR.resolve("domain-model.puml"), sb.toString());
    }

    private boolean hasAnnotation(JavaClass clazz, String simpleName) {
        return clazz.getAnnotations().stream()
            .anyMatch(a -> a.getRawType().getSimpleName().equals(simpleName));
    }

    private boolean hasAnnotation(JavaField field, String simpleName) {
        return field.getAnnotations().stream()
            .anyMatch(a -> a.getRawType().getSimpleName().equals(simpleName));
    }

    private String collectionElementName(JavaField field) {
        JavaType type = field.getType();
        if (type instanceof JavaParameterizedType pt && !pt.getActualTypeArguments().isEmpty())
            return pt.getActualTypeArguments().get(0).toErasure().getSimpleName();
        return null;
    }
}
