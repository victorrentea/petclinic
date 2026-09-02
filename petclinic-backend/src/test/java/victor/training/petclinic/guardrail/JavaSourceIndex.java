package victor.training.petclinic.guardrail;

import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.BodyDeclaration;
import com.github.javaparser.ast.body.CallableDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.type.Type;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Every method of the app as the READER sees it: source text, line numbers and Cognitive
 * Complexity, indexed under the same internal name ASM uses for the compiled method, so the
 * bytecode call graph can be scored against the source it came from.
 *
 * <p>Two roots are indexed, on purpose:
 * <ul>
 *   <li><b>src/main/java</b> — the hand-written code;</li>
 *   <li><b>target/generated-sources/annotations</b> — the MapStruct {@code *MapperImpl}s. They
 *       are real Java, they really do run inside the flow, and their null-check ladders are a
 *       large part of what the old cyclomatic number was measuring. Tagged {@code generated}
 *       in the report so nobody mistakes them for code to go and fix.</li>
 * </ul>
 *
 * <p>Lombok accessors have no source anywhere and therefore score 0 — which is the right
 * answer for a metric about understandability: there is nothing to read.
 *
 * <p>Local and anonymous classes are deliberately NOT indexed as types of their own: per the
 * Sonar definition their bodies count inside the method that declares them (one nesting level
 * deeper), and the synthetic {@code Outer$1} that ASM sees then correctly scores 0.
 */
final class JavaSourceIndex {

    /** One method, keyed the way ASM names it: {@code pkg/Outer$Inner}, {@code <init>} for a ctor. */
    record SourceMethod(String owner, String name, List<String> parameterTypes, Path file,
            boolean generated, int firstLine, List<String> sourceLines, CognitiveComplexity.Score score) {

        int cognitive() {
            return score.total();
        }
    }

    private final Map<String, List<SourceMethod>> byOwnerNameArity = new HashMap<>();

    JavaSourceIndex(List<Path> roots) {
        com.github.javaparser.StaticJavaParser.getParserConfiguration()
                .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);
        for (Path root : roots) {
            if (Files.isDirectory(root)) {
                indexRoot(root);
            }
        }
    }

    /**
     * The compiled method's source, if this repo has any. Matching is by owner + name + arity;
     * the parameter types only break ties between overloads, because resolving a source type to
     * a bytecode descriptor would need a full symbol solver for no gain here.
     */
    Optional<SourceMethod> find(String owner, String name, List<String> parameterSimpleTypes) {
        List<SourceMethod> exact = byOwnerNameArity
                .getOrDefault(key(owner, name, parameterSimpleTypes.size()), List.of());
        // an inner class constructor carries a synthetic reference to its outer instance
        List<SourceMethod> candidates = !exact.isEmpty() || !"<init>".equals(name) || parameterSimpleTypes.isEmpty()
                ? exact
                : byOwnerNameArity.getOrDefault(key(owner, name, parameterSimpleTypes.size() - 1), List.of());
        if (candidates.size() <= 1) {
            return candidates.stream().findFirst();
        }
        return candidates.stream()
                .filter(candidate -> candidate.parameterTypes().equals(parameterSimpleTypes))
                .findFirst()
                .or(() -> candidates.stream().findFirst());
    }

    // ── Indexing ───────────────────────────────────────────────────────────────

    private void indexRoot(Path root) {
        boolean generated = root.toString().contains("generated-sources");
        try (Stream<Path> files = Files.walk(root)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).sorted().toList()) {
                indexFile(file, generated);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void indexFile(Path file, boolean generated) throws IOException {
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        CompilationUnit unit = com.github.javaparser.StaticJavaParser.parse(file);
        String packagePrefix = unit.getPackageDeclaration()
                .map(p -> p.getNameAsString().replace('.', '/') + "/").orElse("");
        for (TypeDeclaration<?> type : unit.getTypes()) {
            indexType(type, packagePrefix + type.getNameAsString(), file, generated, lines);
        }
    }

    private void indexType(TypeDeclaration<?> type, String owner, Path file, boolean generated,
            List<String> lines) {
        for (BodyDeclaration<?> member : type.getMembers()) {
            if (member instanceof CallableDeclaration<?> callable) {
                indexCallable(callable, owner, file, generated, lines);
            } else if (member instanceof TypeDeclaration<?> nested) {
                indexType(nested, owner + "$" + nested.getNameAsString(), file, generated, lines);
            }
        }
    }

    private void indexCallable(CallableDeclaration<?> callable, String owner, Path file,
            boolean generated, List<String> lines) {
        String name = callable instanceof ConstructorDeclaration ? "<init>" : callable.getNameAsString();
        List<String> parameterTypes = callable.getParameters().stream()
                .map(parameter -> simpleNameOf(parameter.getType()))
                .toList();
        int firstLine = declarationLineOf(callable);
        int lastLine = callable.getEnd().map(position -> position.line).orElse(firstLine);
        SourceMethod method = new SourceMethod(owner, name, parameterTypes, file, generated, firstLine,
                lines.subList(Math.min(firstLine - 1, lines.size()), Math.min(lastLine, lines.size())),
                CognitiveComplexity.of(callable));
        byOwnerNameArity.computeIfAbsent(key(owner, name, parameterTypes.size()), k -> new ArrayList<>())
                .add(method);
    }

    /** Where the signature starts — annotations above it are context, not code to score. */
    private static int declarationLineOf(CallableDeclaration<?> callable) {
        int nameLine = callable.getName().getBegin().map(position -> position.line).orElse(1);
        if (callable instanceof MethodDeclaration method) {
            return method.getType().getBegin().map(position -> Math.min(position.line, nameLine)).orElse(nameLine);
        }
        return nameLine;
    }

    /** {@code java.util.List<Owner>} and {@code List<Owner>} both erase to {@code List}. */
    private static String simpleNameOf(Type type) {
        String text = type.asString();
        int generics = text.indexOf('<');
        if (generics >= 0) {
            text = text.substring(0, generics) + text.substring(text.lastIndexOf('>') + 1);
        }
        return text.substring(text.lastIndexOf('.') + 1);
    }

    private static String key(String owner, String name, int arity) {
        return owner + "#" + name + "#" + arity;
    }
}
