package victor.training.petclinic.genseq;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Scope;

/**
 * The sentences of a @SpringBootTest, so the generated diagram can say which one caused which call.
 * <p>
 * A mark, not a block:
 *
 * <pre>
 *     given("an owner with one pet");
 *     int ownerId = ownerRepository.save(anOwnerWithAPet()).getId();
 *
 *     when("the owner is fetched");
 *     mockMvc.perform(get("/api/owners/{id}", ownerId));
 * </pre>
 *
 * A <code>given(String, Runnable)</code> would have scoped itself properly, but it forces every
 * value the next sentence needs out of the test's own locals and into a field or a holder — and a
 * test that has to be restructured to be drawn is a test nobody will draw. Each mark simply closes
 * the span the previous one opened, which is the same shape the TypeScript side uses (a timestamp
 * per sentence, see petclinic-test/src/genseq/steps.ts) — only here the mark can be a real span,
 * because the test and the code under test share one JVM and therefore one OTel context.
 * <p>
 * Everything the sentence goes on to do — the MockMvc call, the repository save, the SQL underneath
 * it — lands inside that span, and that parentage is what the renderer draws as an arrow leaving
 * the Test lifeline.
 */
public final class Steps {

    /**
     * The lifeline this span belongs on. Nothing else in the trace can tell the test apart from the
     * code it drives: both run in one JVM under one <code>service.name</code>, so without this the
     * whole diagram collapses onto a single participant. Read by petclinic-test's trace-to-puml.ts.
     */
    static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");

    static final String TEST_PARTICIPANT = "Test";

    /** The step currently open on this thread — JUnit runs a test's before/body/after on one. */
    private static final ThreadLocal<Open> current = new ThreadLocal<>();

    private record Open(Span span, Scope scope) {
    }

    private Steps() {
    }

    public static void given(String sentence) {
        announce("given " + sentence);
    }

    public static void when(String sentence) {
        announce("when " + sentence);
    }

    public static void then(String sentence) {
        announce("then " + sentence);
    }

    /** Continues whichever of the three came before it, exactly as Gherkin's `And` does. */
    public static void and(String sentence) {
        announce("and " + sentence);
    }

    private static void announce(String sentence) {
        close();
        Span span = GlobalOpenTelemetry.getTracer("petclinic-genseq")
                .spanBuilder(sentence)
                .setAttribute(PARTICIPANT, TEST_PARTICIPANT)
                .startSpan();
        // The scope is deliberately held open across the statements that follow rather than
        // closed by a try-with-resources: the sentence lasts until the next sentence starts.
        current.set(new Open(span, span.makeCurrent()));
    }

    /** Closes the last sentence of a test. Called by {@link SequenceTraceExtension} on the way out. */
    static void close() {
        Open open = current.get();
        if (open == null) {
            return;
        }
        current.remove();
        // Scopes must be closed on the thread that opened them, innermost first — which is exactly
        // what this is, since a new sentence never opens before the previous one has closed.
        open.scope().close();
        open.span().end();
    }
}
