package victor.training.petclinic.guardrail;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class DomainModelExtractorTest {

    private static final String BASE_PKG          = "victor.training.petclinic";
    private static final String DOMAIN_MODEL_PKG  = BASE_PKG + ".model";
    private static final Path   GENERATED_DIR     = Paths.get("docs/generated");

    private record Association(String fromClass, String fromCardinality, String toClass, String toCardinality, String label) {}

    @Test
    void generateDomainModelDiagram() throws IOException {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(DOMAIN_MODEL_PKG);

        List<Class<?>> entities = classes.stream()
            .filter(c -> c.getPackageName().equals(DOMAIN_MODEL_PKG))
            .filter(c -> !c.isAnonymousClass() && !c.isInnerClass())
            .<Class<?>>map(JavaClass::reflect)
            .sorted(Comparator.comparing(Class::getSimpleName))
            .toList();

        List<Association> associations = collectAssociations(entities);

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n\n");
        sb.append("title Domain Model\n");
        sb.append("caption Generated from JPA annotations\n\n");
        sb.append("hide empty members\n");
        sb.append("skinparam classAttributeIconSize 0\n\n");

        for (Class<?> cls : entities) {
            sb.append(cls.isEnum() ? "enum " : "class ").append(cls.getSimpleName());
            List<String> members = renderMembers(cls);
            if (members.isEmpty()) {
                sb.append("\n");
            } else {
                sb.append(" {\n");
                for (String m : members) sb.append("  ").append(m).append("\n");
                sb.append("}\n");
            }
        }
        sb.append("\n");

        for (Association a : associations) {
            sb.append(a.fromClass())
              .append(" \"").append(a.fromCardinality()).append("\" ")
              .append("--")
              .append(" \"").append(a.toCardinality()).append("\" ")
              .append(a.toClass());
            if (a.label() != null && !a.label().isBlank()) {
                sb.append(" : ").append(a.label());
            }
            sb.append("\n");
        }

        sb.append("\n@enduml\n");

        Files.createDirectories(GENERATED_DIR);
        Files.writeString(GENERATED_DIR.resolve("DomainModel.puml"), sb.toString());

        assertThat(GENERATED_DIR.resolve("DomainModel.puml")).exists();
    }

    private List<Association> collectAssociations(List<Class<?>> entities) {
        Set<Class<?>> entitySet = new HashSet<>(entities);
        List<Association> result = new ArrayList<>();
        Set<String> emittedPairs = new HashSet<>();

        for (Class<?> cls : entities) {
            for (Field field : cls.getDeclaredFields()) {
                Class<?> targetType = associationTargetType(field, entitySet);
                if (targetType == null) continue;

                OneToMany oneToMany = field.getAnnotation(OneToMany.class);
                ManyToOne manyToOne = field.getAnnotation(ManyToOne.class);
                ManyToMany manyToMany = field.getAnnotation(ManyToMany.class);
                OneToOne oneToOne = field.getAnnotation(OneToOne.class);

                if (oneToMany != null && !oneToMany.mappedBy().isBlank()) continue;
                if (manyToMany != null && !manyToMany.mappedBy().isBlank()) continue;
                if (oneToOne != null && !oneToOne.mappedBy().isBlank()) continue;

                String pairKey = pairKey(cls, targetType);

                if (manyToOne != null) {
                    boolean bidirectional = hasInverse(targetType, OneToMany.class, field.getName());
                    if (bidirectional && !emittedPairs.add(pairKey)) continue;
                    result.add(new Association(targetType.getSimpleName(), "1", cls.getSimpleName(), "0..*", field.getName()));
                } else if (oneToMany != null) {
                    if (!emittedPairs.add(pairKey)) continue;
                    result.add(new Association(cls.getSimpleName(), "1", targetType.getSimpleName(), "0..*", field.getName()));
                } else if (manyToMany != null) {
                    if (!emittedPairs.add(pairKey)) continue;
                    result.add(new Association(cls.getSimpleName(), "0..*", targetType.getSimpleName(), "0..*", field.getName()));
                } else if (oneToOne != null) {
                    if (!emittedPairs.add(pairKey)) continue;
                    result.add(new Association(cls.getSimpleName(), "1", targetType.getSimpleName(), "1", field.getName()));
                }
            }
        }
        return result;
    }

    private Class<?> associationTargetType(Field field, Set<Class<?>> entitySet) {
        if (field.getAnnotation(OneToMany.class) == null
            && field.getAnnotation(ManyToOne.class) == null
            && field.getAnnotation(ManyToMany.class) == null
            && field.getAnnotation(OneToOne.class) == null) {
            return null;
        }
        Class<?> raw = field.getType();
        if (entitySet.contains(raw)) return raw;
        Type generic = field.getGenericType();
        if (generic instanceof ParameterizedType pt) {
            for (Type arg : pt.getActualTypeArguments()) {
                if (arg instanceof Class<?> c && entitySet.contains(c)) return c;
            }
        }
        return null;
    }

    private boolean hasInverse(Class<?> target, Class<? extends Annotation> annotationType, String fieldName) {
        for (Field f : target.getDeclaredFields()) {
            Annotation a = f.getAnnotation(annotationType);
            if (a == null) continue;
            String mappedBy = mappedByOf(a);
            if (fieldName.equals(mappedBy)) return true;
        }
        return false;
    }

    private String mappedByOf(Annotation a) {
        if (a instanceof OneToMany o) return o.mappedBy();
        if (a instanceof ManyToMany m) return m.mappedBy();
        if (a instanceof OneToOne o) return o.mappedBy();
        return "";
    }

    private String pairKey(Class<?> a, Class<?> b) {
        String x = a.getSimpleName();
        String y = b.getSimpleName();
        return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
    }

    private List<String> renderMembers(Class<?> cls) {
        List<String> lines = new ArrayList<>();
        if (cls.isEnum()) {
            for (Object value : cls.getEnumConstants()) {
                lines.add(((Enum<?>) value).name());
            }
            return lines;
        }
        for (Field field : cls.getDeclaredFields()) {
            int mods = field.getModifiers();
            if (Modifier.isStatic(mods) || Modifier.isTransient(mods) || field.isSynthetic()) continue;
            if (field.getAnnotation(OneToMany.class) != null
                || field.getAnnotation(ManyToOne.class) != null
                || field.getAnnotation(ManyToMany.class) != null
                || field.getAnnotation(OneToOne.class) != null) {
                continue;
            }
            lines.add(field.getName() + " : " + typeName(field.getGenericType()));
        }
        return lines;
    }

    private String typeName(Type type) {
        if (type instanceof Class<?> c) {
            return c.isArray() ? typeName(c.getComponentType()) + "[]" : c.getSimpleName();
        }
        if (type instanceof ParameterizedType pt) {
            StringBuilder sb = new StringBuilder(typeName(pt.getRawType())).append("<");
            Type[] args = pt.getActualTypeArguments();
            for (int i = 0; i < args.length; i++) {
                if (i > 0) sb.append(", ");
                sb.append(typeName(args[i]));
            }
            return sb.append(">").toString();
        }
        return type.getTypeName();
    }
}
