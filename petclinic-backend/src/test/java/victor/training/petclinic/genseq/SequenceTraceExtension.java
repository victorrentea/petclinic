package victor.training.petclinic.genseq;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Scope;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.platform.commons.support.AnnotationSupport;

/**
 * Captures one test method as a Tempo trace and leaves behind the same "trace window" the browser
 * suites leave, so the existing generator draws the diagram — see
 * petclinic-test/src/genseq/generate.ts. Nothing here renders anything: the whole point is that a
 * @SpringBootTest is a fourth kind of test feeding one pipeline, not a second pipeline.
 * <p>
 * What it does per test:
 * <ol>
 * <li>opens a root span stamped <code>test.name</code>, which is the only handle the generator has
 * on this run — it searches Tempo for <code>{ span.test.name = "…" }</code>;</li>
 * <li>declares that span's lifeline to be <em>Test</em>, so the picture can show the test calling
 * the application rather than the application calling itself;</li>
 * <li>writes <code>petclinic-test/test-results/trace-windows/&lt;hash&gt;.json</code> — the start
 * and end of the interval whose traces belong to this test.</li>
 * </ol>
 * The window carries no <code>steps</code> array, unlike the ones the .feature and .spec.ts runners
 * write: here the sentences are spans inside the trace itself ({@link Steps}), so they arrive with
 * the traces rather than beside them.
 * <p>
 * With no agent attached this is all no-ops on a no-op tracer, and the window it writes describes an
 * interval Tempo has nothing in — the generator logs "no traces in window" and moves on.
 * <p>
 * Which tests: those carrying {@link GenerateSequence}, and — under <code>-Pgenseq</code>, where the
 * extension is autodetected on every test — those <code>GENSEQ_SELECT</code> names, untagged.
 */
public class SequenceTraceExtension implements BeforeEachCallback, AfterEachCallback {

    /** What the generator searches Tempo by; the same attribute the browser spans carry. */
    private static final AttributeKey<String> TEST_NAME = AttributeKey.stringKey("test.name");

    private static final String WINDOWS_DIR = "petclinic-test/test-results/trace-windows";

    /**
     * Padding, mirroring the two browser runners: the exporter batches, and Tempo ingests
     * asynchronously, so a window closed on the last assertion would miss the spans of the calls it
     * was drawn for.
     */
    private static final long PRE_PAD_MS = 1_000;

    private static final long POST_PAD_MS = 5_000;

    private static final ExtensionContext.Namespace NAMESPACE = ExtensionContext.Namespace
            .create(SequenceTraceExtension.class);

    /**
     * Each runner clears its own windows before it starts, and only its own — the store is also what
     * a standalone `npm run diagram` replays, and wiping it whole would shrink that to whichever
     * suite ran last. Once per JVM, which for surefire is once per run — except a GENSEQ_SELECT run,
     * which is a second JVM straight after the tagged one and must ADD to its windows, not erase
     * them: the diagrams are rendered once, after both.
     */
    private static final AtomicBoolean swept = new AtomicBoolean();

    /**
     * The tests to trace that carry no {@link GenerateSequence}: <code>Class#method</code>, comma
     * separated — the very string <code>-Dtest=</code> takes, so /human-review passes one value to
     * both (human-review.json, steps.sequence.select). Its presence also makes the run additive: see
     * {@link #forgetPreviousRunOnce}.
     */
    static final String SELECT_ENV = "GENSEQ_SELECT";

    @Override
    public void beforeEach(ExtensionContext context) {
        // Registered twice on a tagged test — by @GenerateSequence and by autodetection under
        // -Pgenseq — JUnit keeps one; this keeps it one even if it did not.
        if (context.getStore(NAMESPACE).get(Run.class) != null) {
            return;
        }
        String select = System.getenv(SELECT_ENV);
        boolean tagged = isTagged(context);
        if (!tagged && !isSelected(select, context)) {
            return;
        }
        String title = titleOf(context, tagged);
        Span span = GlobalOpenTelemetry.getTracer("petclinic-genseq")
                .spanBuilder("test: " + title)
                .setAttribute(TEST_NAME, title)
                .setAttribute(Steps.PARTICIPANT, Steps.TEST_PARTICIPANT)
                .startSpan();
        // No agent attached: this is an ordinary `mvn test`, the tracer is a no-op and there
        // will be nothing in Tempo to draw. Recording a window anyway would overwrite the one a
        // real traced run left, and the next `npm run diagram:java` would search an interval that
        // holds no traces — a plain test run silently costing the diagram.
        if (!span.isRecording()) {
            span.end();
            return;
        }
        if (select == null || select.isBlank()) {
            forgetPreviousRunOnce();
        }
        context.getStore(NAMESPACE).put(Run.class, new Run(span, span.makeCurrent(),
                System.currentTimeMillis() - PRE_PAD_MS, title));
    }

    private static boolean isTagged(ExtensionContext context) {
        return context.getTestMethod().map(m -> AnnotationSupport.isAnnotated(m, GenerateSequence.class))
                .orElse(false)
                || context.getTestClass().map(c -> AnnotationSupport.isAnnotated(c, GenerateSequence.class))
                        .orElse(false);
    }

    /**
     * Named in <code>select</code> — and, for a parameterized or repeated test, only its first
     * invocation: one picture per test asked for, not one per row of its arguments.
     */
    static boolean isSelected(String select, ExtensionContext context) {
        if (select == null || select.isBlank() || context.getTestMethod().isEmpty()) {
            return false;
        }
        String uniqueId = context.getUniqueId();
        if (uniqueId.contains("-invocation:#") && !uniqueId.endsWith("-invocation:#1]")) {
            return false;
        }
        return selects(select, context.getRequiredTestClass(), context.getRequiredTestMethod().getName());
    }

    /** <code>OwnerListTest#a+b,pkg.OtherTest#c</code>, a class with no method meaning all of it. */
    static boolean selects(String select, Class<?> testClass, String method) {
        Class<?> outer = testClass;
        while (outer.getEnclosingClass() != null) {
            outer = outer.getEnclosingClass();
        }
        for (String item : select.split(",")) {
            String[] parts = item.trim().split("#", 2);
            String cls = parts[0];
            boolean classMatches = cls.equals(outer.getName()) || cls.equals(outer.getSimpleName())
                    || cls.equals(testClass.getName()) || cls.equals(testClass.getSimpleName());
            if (classMatches && (parts.length == 1 || List.of(parts[1].split("\\+")).contains(method))) {
                return true;
            }
        }
        return false;
    }

    /**
     * What the window and the span are named, and so what the diagram is titled. A tagged test
     * keeps its display name, as it always has. A selected invocation of a parameterized test
     * would be titled <code>[1] size=5</code> by it: brackets break the PlantUML link the title is
     * drawn as, and nothing in the source reads like that, so the generator could not point the
     * title at the method. The method's own name can be found, and is what was asked for.
     */
    private static String titleOf(ExtensionContext context, boolean tagged) {
        if (!tagged && context.getUniqueId().contains("-invocation:#")) {
            return context.getRequiredTestMethod().getName();
        }
        return context.getDisplayName();
    }

    @Override
    public void afterEach(ExtensionContext context) {
        Run run = context.getStore(NAMESPACE).remove(Run.class, Run.class);
        if (run == null) {
            return;
        }
        Steps.close();
        run.scope().close();
        run.span().end();
        writeWindow(sourceOf(context), run.title(), run.startMs());
    }

    private record Run(Span span, Scope scope, long startMs, String title) {
    }

    // ---------------------------------------------------------------------
    // The window store, as the TypeScript side defines it
    // ---------------------------------------------------------------------

    /**
     * One file per window, named after the scenario — never one file for all of them. The reasoning
     * is petclinic-test/src/support/trace-window-store.ts's, and the hash has to agree with
     * <code>windowFileName()</code> there or a re-run would add a window instead of replacing one.
     */
    private void writeWindow(String source, String title, long startMs) {
        Path dir = repoRoot().resolve(WINDOWS_DIR);
        String json = """
                {
                    "title": %s,
                    "source": %s,
                    "startMs": %d,
                    "endMs": %d
                }
                """.formatted(quote(title), quote(source), startMs,
                System.currentTimeMillis() + POST_PAD_MS);
        try {
            Files.createDirectories(dir);
            Path file = dir.resolve(sha1(source + "::" + title).substring(0, 16) + ".json");
            // Written aside and renamed into place, so a reader never sees half a document.
            Path temp = dir.resolve(file.getFileName() + "." + ProcessHandle.current().pid() + ".tmp");
            Files.writeString(temp, json, StandardCharsets.UTF_8);
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            // Telemetry must never fail a test: the worst case is one diagram missing.
            System.err.println("⚠️  genseq: could not record the trace window (" + e.getMessage() + ")");
        }
    }

    private void forgetPreviousRunOnce() {
        if (!swept.compareAndSet(false, true)) {
            return;
        }
        Path dir = repoRoot().resolve(WINDOWS_DIR);
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (Stream<Path> files = Files.list(dir)) {
            for (Path file : files.toList()) {
                // Only this runner's: a window whose source is a .java file is one of ours.
                if (file.getFileName().toString().endsWith(".json")
                        && Files.readString(file).contains(".java\"")) {
                    Files.deleteIfExists(file);
                }
            }
        } catch (IOException e) {
            System.err.println("⚠️  genseq: could not clear the previous run's windows (" + e.getMessage() + ")");
        }
    }

    // ---------------------------------------------------------------------
    // Where the diagram is filed: next to the test, like every other one
    // ---------------------------------------------------------------------

    /**
     * The test's source file, relative to petclinic-test — which is the directory the generator
     * resolves every diagram path against, so a Java test's diagram climbs back out of it with `..`
     * and lands beside the .java file it was drawn from.
     */
    private String sourceOf(ExtensionContext context) {
        Class<?> testClass = context.getRequiredTestClass();
        while (testClass.getEnclosingClass() != null) {
            testClass = testClass.getEnclosingClass(); // a @Nested class lives in its outer file
        }
        return "../petclinic-backend/src/test/java/"
                + testClass.getName().replace('.', '/') + ".java";
    }

    /** The checkout root, found by the one directory that is only ever at its top. */
    private Path repoRoot() {
        for (Path dir = Path.of("").toAbsolutePath(); dir != null; dir = dir.getParent()) {
            if (Files.isDirectory(dir.resolve("petclinic-test"))) {
                return dir;
            }
        }
        throw new IllegalStateException("Cannot find the repository root above " + Path.of("").toAbsolutePath());
    }

    private static String sha1(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // SHA-1 is required of every JRE
        }
    }

    /** A JSON string literal — a test name may hold quotes, backslashes or a newline. */
    private static String quote(String text) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> out.append(c < 0x20 ? String.format("\\u%04x", (int) c) : c);
            }
        }
        return out.append('"').toString();
    }
}
