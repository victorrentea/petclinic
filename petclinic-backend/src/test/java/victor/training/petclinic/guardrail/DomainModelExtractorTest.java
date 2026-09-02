package victor.training.petclinic.guardrail;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
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

    private static final Path GENERATED_DIR = Paths.get("docs/generated");
    private static final Path SOURCE_ROOT = Paths.get("src/main/java");

    // One wording for every link. Naming the member in its own tooltip only repeated the
    // text the pointer was already on, and the legend says what clicking does anyway.
    private static final String TOOLTIP = "{Click to open in editor}";

    /** What the model *is*; this test only decides how to draw it. */
    private final DomainModelExtractor model = new DomainModelExtractor();

    @Test
    void generateDomainModelDiagram() throws IOException {
        List<Class<?>> entities = model.domainClasses();
        List<DomainModelExtractor.Association> associations = model.associations(entities);

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n\n");
        sb.append("title Domain Model\n");
        sb.append("caption Diagram generated from code using Java reflection\n");
        sb.append("footer domain/*.java -> "
                + "petclinic-backend/docs/generated/DomainModel.puml\n\n");
        sb.append("hide empty members\n");
        sb.append("skinparam classAttributeIconSize 0\n");
        // Every class box is a link to its declaration. Underlining them would put a blue
        // rule across the diagram, and the affordance is not worth that: the legend says
        // once what would otherwise be said on every box.
        sb.append("skinparam hyperlinkUnderline false\n");
        sb.append("skinparam hyperlinkColor #000000\n");
        // Emitted before the classes so it survives the review diff, which copies the
        // preamble from the new side and starts its own output at the first element.
        sb.append("legend bottom\n");
        sb.append("  Click any class to jump to the source code.\n");
        sb.append("end legend\n\n");

        for (Class<?> cls : entities) {
            sb.append(cls.isEnum() ? "enum " : "class ").append(cls.getSimpleName())
                    .append(sourceLink(cls, cls.getSimpleName()));

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

        for (DomainModelExtractor.Association a : associations) {
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
            if (model.isSkippable(f))
                continue;
            if (model.referencedDomainClass(f, domain) != null)
                continue; // association, not attribute
            lines.add(f.getName() + " : " + typeName(f.getGenericType()));
        }
        return lines;
    }

    // ── Source links: click a class, land on its declaration ──────────────────

    /**
     * The link the reviewer clicks, as a repo-relative `src://path:line` handle.
     *
     * Deliberately NOT an absolute `vscode://file/...` URL: this .puml is a committed
     * artifact, and baking `/Users/someone/...` into it makes every machine that
     * regenerates it produce a diff. The review page resolves the handle against its
     * own checkout when it inlines the SVG.
     *
     * Reflection knows the classes but not where they were written, so the line is
     * found by reading the source file back — no line, and the link still opens the
     * file at the top.
     *
     * Only the class box carries one. Every field used to be a link of its own, which
     * made the whole diagram clickable and none of it legible as a diagram: a model is
     * read class by class, and landing on the class is one keystroke from the field.
     * A class *header* link needs no label either — PlantUML hangs it off the box
     * rather than printing it, so the box itself stays the thing you click.
     */
    private String sourceLink(Class<?> cls, String member) {
        if (sourceFileOf(cls) == null)
            return "";
        return " [[" + handle(cls, member) + TOOLTIP + "]]";
    }

    private String handle(Class<?> cls, String member) {
        Path source = sourceFileOf(cls);
        int line = lineOfDeclaration(source, member);
        // The test runs with the module as its working directory, so the paths it has
        // are module-relative; the review page resolves against the repo root.
        String module = Paths.get("").toAbsolutePath().getFileName().toString();
        String rel = module + "/" + source.toString().replace('\\', '/');
        return "src://" + rel + (line > 0 ? ":" + line : "");
    }

    private Path sourceFileOf(Class<?> cls) {
        Path file = SOURCE_ROOT.resolve(cls.getName().replace('.', '/') + ".java");
        return Files.isRegularFile(file) ? file : null;
    }

    /**
     * The line `member` is declared on, matched as a whole word before the `;`, `=`, `,`
     * or `(` that can follow it. Comments and Javadoc mentioning the name are skipped,
     * since a `*`-continued line is never a declaration.
     */
    private int lineOfDeclaration(Path source, String member) {
        Pattern declaration = Pattern.compile(
                "(^|[^\\w.])" + Pattern.quote(member) + "\\s*([;=,(){]|$)");
        try {
            List<String> lines = Files.readAllLines(source);
            for (int i = 0; i < lines.size(); i++) {
                String line = lines.get(i);
                String trimmed = line.trim();
                if (trimmed.startsWith("*") || trimmed.startsWith("//"))
                    continue;
                if (declaration.matcher(line).find())
                    return i + 1;
            }
        } catch (IOException e) {
            return 0; // unreadable source is a missing line number, not a failed build
        }
        return 0;
    }

    private String typeName(Type type) {
        if (type instanceof Class<?> c) {
            return c.isArray() ? typeName(c.getComponentType()) + "[]" : c.getSimpleName();
        }
        if (type instanceof ParameterizedType pt) {
            StringBuilder sb = new StringBuilder(typeName(pt.getRawType())).append("<");
            Type[] args = pt.getActualTypeArguments();
            for (int i = 0; i < args.length; i++) {
                if (i > 0)
                    sb.append(", ");
                sb.append(typeName(args[i]));
            }
            return sb.append(">").toString();
        }
        return type.getTypeName();
    }
}
