package victor.training.petclinic.guardrail;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Generates docs/generated/DomainModel.puml from the domain classes using PLAIN
 * JAVA REFLECTION — no JPA (or any other) annotations — so it works on models that
 * express relationships with ordinary fields, not @OneToMany/@ManyToOne. Rules,
 * inferred from field types alone:
 * <ul>
 *   <li>a field whose (element) type is another domain class → an association;
 *       every other non-static field → an attribute;</li>
 *   <li>a collection field ⇒ the target end is "0..*"; a single reference ⇒ "1";</li>
 *   <li>when only one side declares the reference (unidirectional), the missing end
 *       defaults to the classic foreign-key shape: a lone single ref implies "0..*"
 *       referrers; a lone collection implies a single "1" owner.</li>
 * </ul>
 * The price of dropping annotations: a unidirectional collection can't be told apart
 * from a many-to-many join table, so it renders as one-to-many.
 */
class DomainModelExtractorTest {

    private static final String BASE_PKG         = "victor.training.petclinic";
    private static final String DOMAIN_MODEL_PKG = BASE_PKG + ".domain";
    private static final Path   GENERATED_DIR    = Paths.get("docs/generated");

    private static final String ONE  = "1";
    private static final String MANY = "0..*";

    /** A field that points at another domain class. */
    private record Ref(Class<?> owner, Class<?> target, boolean many, String field) {}

    private record Association(String left, String leftCardinality,
                               String right, String rightCardinality, String label) {}

    @Test
    void generateDomainModelDiagram() throws IOException {
        List<Class<?>> entities = discoverDomainClasses();
        List<Association> associations = collectAssociations(entities);

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n!pragma layout smetana\n\n");
        sb.append("title Domain Model\n");
        sb.append("footer Generated via reflection from domain/*.java by DomainModelExtractorTest\n\n");
        sb.append("hide empty members\n");
        sb.append("skinparam classAttributeIconSize 0\n\n");

        for (Class<?> cls : entities) {
            sb.append(cls.isEnum() ? "enum " : "class ").append(cls.getSimpleName());

            List<String> members = renderMembers(cls, entities);
            if (members.isEmpty()) {
                sb.append("\n");
            } else {
                sb.append(" {\n");
                for (String member : members) {
                    sb.append("  ").append(member).append("\n");
                }
                sb.append("}\n");
            }
        }
        sb.append("\n");

        for (Association a : associations) {
            sb.append(a.left())
              .append(" \"").append(a.leftCardinality()).append("\" -- \"")
              .append(a.rightCardinality()).append("\" ")
              .append(a.right());
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

    private List<Class<?>> discoverDomainClasses() {
        JavaClasses classes = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests())
            .importPackages(DOMAIN_MODEL_PKG);
        return classes.stream()
            .filter(c -> c.getPackageName().equals(DOMAIN_MODEL_PKG))
            .filter(c -> !c.isAnonymousClass() && !c.isInnerClass())
            .<Class<?>>map(JavaClass::reflect)
            .sorted(Comparator.comparing(Class::getSimpleName))
            .toList();
    }

    // ── Associations: derived from field types alone, no annotations ───────────

    private List<Association> collectAssociations(List<Class<?>> entities) {
        Set<Class<?>> domain = new HashSet<>(entities);

        // All directed field references A.field → B, grouped by the unordered {A,B} pair.
        Map<String, List<Ref>> byPair = new LinkedHashMap<>();
        for (Class<?> cls : entities) {
            for (Field f : cls.getDeclaredFields()) {
                if (isSkippable(f)) continue;
                Class<?> target = referencedDomainClass(f, domain);
                if (target == null || target.equals(cls)) continue;   // skip self-references
                byPair.computeIfAbsent(pairKey(cls, target), k -> new ArrayList<>())
                      .add(new Ref(cls, target, isCollection(f.getType()), f.getName()));
            }
        }

        List<Association> result = new ArrayList<>();
        for (List<Ref> refs : byPair.values()) {
            result.add(associationFor(refs));
        }
        result.sort(Comparator.comparing(Association::left).thenComparing(Association::right));
        return result;
    }

    private Association associationFor(List<Ref> refs) {
        Class<?> c1 = refs.get(0).owner();
        Class<?> c2 = refs.get(0).target();
        Class<?> a = c1.getSimpleName().compareTo(c2.getSimpleName()) <= 0 ? c1 : c2;
        Class<?> b = a.equals(c1) ? c2 : c1;

        Ref aToB = directed(refs, a, b);
        Ref bToA = directed(refs, b, a);

        String aPerB = countPerOne(bToA, aToB);   // how many A relate to one B
        String bPerA = countPerOne(aToB, bToA);   // how many B relate to one A

        // Put the parent ("1" side with a "0..*" child) on the left; otherwise keep A left.
        boolean bIsParent = aPerB.equals(MANY) && bPerA.equals(ONE);
        Class<?> left  = bIsParent ? b : a;
        Class<?> right = bIsParent ? a : b;
        String leftMult  = left.equals(a) ? aPerB : bPerA;   // count of LEFT per one RIGHT
        String rightMult = left.equals(a) ? bPerA : aPerB;   // count of RIGHT per one LEFT

        return new Association(left.getSimpleName(), leftMult,
                               right.getSimpleName(), rightMult, chooseLabel(refs));
    }

    /** Multiplicity at one end: read the counterpart's field to us, else a reverse default. */
    private String countPerOne(Ref counterpartToThis, Ref thisToCounterpart) {
        if (counterpartToThis != null) return counterpartToThis.many() ? MANY : ONE;
        if (thisToCounterpart != null) return thisToCounterpart.many() ? ONE : MANY;
        return ONE;
    }

    private Ref directed(List<Ref> refs, Class<?> from, Class<?> to) {
        return refs.stream()
            .filter(r -> r.owner().equals(from) && r.target().equals(to))
            .findFirst().orElse(null);
    }

    /** Label the edge with a field name, preferring the to-one side (owner, pet, user…). */
    private String chooseLabel(List<Ref> refs) {
        return refs.stream()
            .sorted(Comparator.comparing(Ref::many)                      // to-one (false) first
                              .thenComparing(r -> r.owner().getSimpleName()))
            .map(Ref::field)
            .findFirst().orElse(null);
    }

    // ── Members: every non-static field that is not itself an association ──────

    private List<String> renderMembers(Class<?> cls, List<Class<?>> entities) {
        Set<Class<?>> domain = new HashSet<>(entities);
        List<String> lines = new ArrayList<>();
        if (cls.isEnum()) {
            for (Object value : cls.getEnumConstants()) {
                lines.add(((Enum<?>) value).name());
            }
            return lines;
        }
        for (Field f : cls.getDeclaredFields()) {
            if (isSkippable(f)) continue;
            if (referencedDomainClass(f, domain) != null) continue;   // association, not attribute
            lines.add(f.getName() + " : " + typeName(f.getGenericType()));
        }
        return lines;
    }

    // ── Reflection helpers ─────────────────────────────────────────────────────

    /** The domain class a field points at (directly or as a collection element), or null. */
    private Class<?> referencedDomainClass(Field field, Set<Class<?>> domain) {
        Class<?> raw = field.getType();
        if (domain.contains(raw)) return raw;
        if (isCollection(raw) && field.getGenericType() instanceof ParameterizedType pt) {
            for (Type arg : pt.getActualTypeArguments()) {
                if (arg instanceof Class<?> c && domain.contains(c)) return c;
            }
        }
        return null;
    }

    private boolean isCollection(Class<?> type) {
        return Collection.class.isAssignableFrom(type);
    }

    private boolean isSkippable(Field f) {
        int m = f.getModifiers();
        return Modifier.isStatic(m) || Modifier.isTransient(m) || f.isSynthetic();
    }

    private String pairKey(Class<?> a, Class<?> b) {
        String x = a.getSimpleName();
        String y = b.getSimpleName();
        return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
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
