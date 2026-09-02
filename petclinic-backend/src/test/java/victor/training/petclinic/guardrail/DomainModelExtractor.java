package victor.training.petclinic.guardrail;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The domain model as the code actually declares it — classes and the associations
 * between them, with cardinalities — read with PLAIN JAVA REFLECTION, no JPA (or any
 * other) annotations. Rules, inferred from field types alone:
 * <ul>
 *   <li>a field whose (element) type is another domain class → an association;</li>
 *   <li>a collection field ⇒ the target end is "0..*"; a single reference ⇒ "1";</li>
 *   <li>when only one side declares the reference (unidirectional), the missing end
 *       defaults to the classic foreign-key shape: a lone single ref implies "0..*"
 *       referrers; a lone collection implies a single "1" owner.</li>
 * </ul>
 * The price of dropping annotations: a unidirectional collection can't be told apart
 * from a many-to-many join table, so it reads as one-to-many.
 *
 * <p>This lives apart from any one test because two guardrails now compare a drawing
 * against it — {@link DomainModelExtractorTest}, which regenerates the PlantUML, and
 * {@link ConceptualModelDiagramTest}, which checks the hand-laid-out draw.io map. A second
 * copy of these rules would be a second opinion about what the model is, and the two
 * pictures could then disagree while both passing.
 */
class DomainModelExtractor {

    static final String ONE = "1";
    static final String MANY = "0..*";

    private static final String DOMAIN_MODEL_PKG = "victor.training.petclinic.domain";

    /** A field that points at another domain class. */
    private record Ref(Class<?> owner, Class<?> target, boolean many, String field) {
    }

    /**
     * One line between two concepts. {@code leftCardinality} is how many LEFT relate to
     * one RIGHT — the end drawn next to the left concept, exactly as PlantUML's
     * {@code Left "1" -- "0..*" Right} reads.
     */
    record Association(String left, String leftCardinality,
            String right, String rightCardinality, String label) {

        /**
         * The identity of this line, independent of which end got drawn on the left: the
         * two concept names in alphabetical order. Only one association per pair of
         * classes can exist here — {@link #associations} groups every field reference by
         * the unordered pair — so this names it uniquely.
         */
        String key() {
            return left.compareTo(right) <= 0 ? left + "-" + right : right + "-" + left;
        }

        /** How many {@code concept} relate to one instance of the concept at the far end. */
        String cardinalityAt(String concept) {
            return concept.equals(left) ? leftCardinality : rightCardinality;
        }
    }

    /** Every class in the domain package, alphabetically. */
    List<Class<?>> domainClasses() {
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

    /** Every association between them, derived from field types alone. */
    List<Association> associations(List<Class<?>> entities) {
        Set<Class<?>> domain = new HashSet<>(entities);

        // All directed field references A.field → B, grouped by the unordered {A,B} pair.
        Map<String, List<Ref>> byPair = new LinkedHashMap<>();
        for (Class<?> cls : entities) {
            for (Field f : cls.getDeclaredFields()) {
                if (isSkippable(f))
                    continue;
                Class<?> target = referencedDomainClass(f, domain);
                if (target == null || target.equals(cls))
                    continue; // skip self-references
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

        String aPerB = countPerOne(bToA, aToB); // how many A relate to one B
        String bPerA = countPerOne(aToB, bToA); // how many B relate to one A

        // Put the parent ("1" side with a "0..*" child) on the left; otherwise keep A left.
        boolean bIsParent = aPerB.equals(MANY) && bPerA.equals(ONE);
        Class<?> left = bIsParent ? b : a;
        Class<?> right = bIsParent ? a : b;
        String leftMult = left.equals(a) ? aPerB : bPerA; // count of LEFT per one RIGHT
        String rightMult = left.equals(a) ? bPerA : aPerB; // count of RIGHT per one LEFT

        return new Association(left.getSimpleName(), leftMult,
                right.getSimpleName(), rightMult, chooseLabel(refs));
    }

    /** Multiplicity at one end: read the counterpart's field to us, else a reverse default. */
    private String countPerOne(Ref counterpartToThis, Ref thisToCounterpart) {
        if (counterpartToThis != null)
            return counterpartToThis.many() ? MANY : ONE;
        if (thisToCounterpart != null)
            return thisToCounterpart.many() ? ONE : MANY;
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
                .sorted(Comparator.comparing(Ref::many) // to-one (false) first
                        .thenComparing(r -> r.owner().getSimpleName()))
                .map(Ref::field)
                .findFirst().orElse(null);
    }

    /** The domain class a field points at (directly or as a collection element), or null. */
    Class<?> referencedDomainClass(Field field, Set<Class<?>> domain) {
        Class<?> raw = field.getType();
        if (domain.contains(raw))
            return raw;
        if (isCollection(raw) && field.getGenericType() instanceof ParameterizedType pt) {
            for (Type arg : pt.getActualTypeArguments()) {
                if (arg instanceof Class<?> c && domain.contains(c))
                    return c;
            }
        }
        return null;
    }

    boolean isSkippable(Field f) {
        int m = f.getModifiers();
        return Modifier.isStatic(m) || Modifier.isTransient(m) || f.isSynthetic();
    }

    private boolean isCollection(Class<?> type) {
        return Collection.class.isAssignableFrom(type);
    }

    private String pairKey(Class<?> a, Class<?> b) {
        String x = a.getSimpleName();
        String y = b.getSimpleName();
        return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
    }
}
