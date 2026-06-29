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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class DomainModelExtractorTest {

    private static final String BASE_PKG          = "victor.training.petclinic";
    private static final String DOMAIN_MODEL_PKG  = BASE_PKG + ".model";
    private static final Path   GENERATED_DIR     = Paths.get("docs/generated");
    private static final String BASELINE_REF      = "HEAD:petclinic-backend/docs/generated/DomainModel.puml";
    private static final Pattern CLASS_HEADER     = Pattern.compile("^(?:class|enum)\\s+(\\w+)");

    private record Association(String fromClass, String fromCardinality, String toClass, String toCardinality, String label) {}

    /** Structural fingerprint of the previously committed diagram, used to red-mark what this commit adds. */
    private record Baseline(Set<String> classes, Map<String, Set<String>> members, Set<String> associations) {
        static Baseline empty() { return new Baseline(Set.of(), Map.of(), Set.of()); }
        boolean isEmpty() { return classes.isEmpty() && associations.isEmpty(); }
    }

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
        Baseline baseline = parseBaseline(readBaselinePuml());

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n!pragma layout smetana\n\n");
        sb.append("title Domain Model\n");
        sb.append("caption Generated from JPA annotations — red = added in this commit\n\n");
        sb.append("hide empty members\n");
        sb.append("skinparam classAttributeIconSize 0\n\n");

        for (Class<?> cls : entities) {
            String name = cls.getSimpleName();
            boolean newClass = !baseline.isEmpty() && !baseline.classes().contains(name);
            sb.append(cls.isEnum() ? "enum " : "class ").append(name);
            if (newClass) sb.append(" #line:red;text:red");

            List<String> members = renderMembers(cls);
            if (members.isEmpty()) {
                sb.append("\n");
            } else {
                sb.append(" {\n");
                Set<String> baseMembers = baseline.members().getOrDefault(name, Set.of());
                for (String m : members) {
                    boolean added = !newClass && !baseline.isEmpty() && !baseMembers.contains(m);
                    sb.append("  ").append(added ? red(m) : m).append("\n");
                }
                sb.append("}\n");
            }
        }
        sb.append("\n");

        for (Association a : associations) {
            String label = (a.label() != null && !a.label().isBlank()) ? a.label() : null;
            boolean added = !baseline.isEmpty() && !baseline.associations().contains(cleanAssociation(a, label));
            sb.append(a.fromClass())
              .append(" \"").append(a.fromCardinality()).append("\" ")
              .append(added ? "-[#red]-" : "--")
              .append(" \"").append(a.toCardinality()).append("\" ")
              .append(a.toClass());
            if (label != null) {
                sb.append(" : ").append(added ? red(label) : label);
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

    // ── Commit-scoped diff: red-mark what this commit adds vs the last committed diagram ──────

    private static String red(String text) {
        return "<color:red>" + text + "</color>";
    }

    /** Clean (colour-free) form of an association line, matching what {@link #parseBaseline} stores. */
    private String cleanAssociation(Association a, String label) {
        String s = a.fromClass() + " \"" + a.fromCardinality() + "\" -- \"" + a.toCardinality() + "\" " + a.toClass();
        return label != null ? s + " : " + label : s;
    }

    /** Previously committed DomainModel.puml, or null when absent (bootstrap / no git → no red). */
    private String readBaselinePuml() {
        try {
            Process p = new ProcessBuilder("git", "show", BASELINE_REF).start();
            String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            return p.waitFor() == 0 ? out : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Parse the baseline diagram into class/member/association sets, stripping any prior red markup. */
    private Baseline parseBaseline(String puml) {
        if (puml == null || puml.isBlank()) return Baseline.empty();
        Set<String> classes = new HashSet<>();
        Map<String, Set<String>> members = new HashMap<>();
        Set<String> associations = new HashSet<>();
        String current = null;
        for (String raw : puml.lines().toList()) {
            String line = stripMarkup(raw).strip();
            if (line.isEmpty()) continue;
            if (current == null) {
                Matcher m = CLASS_HEADER.matcher(line);
                if (m.find()) {
                    current = m.group(1);
                    classes.add(current);
                    members.computeIfAbsent(current, k -> new HashSet<>());
                    if (!line.endsWith("{")) current = null;  // member-less class has no body
                    continue;
                }
            }
            if (line.equals("}")) { current = null; continue; }
            if (current != null) { members.get(current).add(line); continue; }
            String assoc = line.replace("-[#red]-", "--");  // normalise red connector back to plain
            if (assoc.contains("--")) associations.add(assoc);
        }
        return new Baseline(classes, members, associations);
    }

    private String stripMarkup(String s) {
        return s.replace("<color:red>", "").replace("</color>", "")
                .replace("<s>", "").replace("</s>", "");
    }
}
