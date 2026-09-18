package victor.training.petclinic.notification;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;

/**
 * Names the lifeline the current span is drawn on in the generated sequence diagrams.
 *
 * <p>{@code genseq.participant} is an existing contract with
 * {@code petclinic-test/src/genseq/trace-to-puml.ts}: a span that sets it is drawn on a
 * participant of its own instead of on the one its {@code service.name} implies. It is what keeps
 * a {@code @SpringBootTest}'s own sentences off the application's lifeline
 * ({@code victor.training.petclinic.genseq.Steps}), and here it is what lets a module that ships
 * inside the backend be drawn as the actor it stands for.
 *
 * <p>Two classes in this package set it — the sender on the way out, the fake gateway on the way
 * in — and they must agree on the spelling, or the picture grows a second lifeline for the same
 * thing. That agreement is this class.
 */
final class Lifeline {

    /** The attribute the generator reads. */
    private static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");

    /** This module, as the rest of the application sees it: one hop away, behind an interface. */
    static final String NOTIFICATION_MODULE = "Notification module";

    /** The thing being called, drawn as the actor it would be if the SMS were real. */
    static final String SMS_GATEWAY = "SMS gateway";

    private Lifeline() {
    }

    /**
     * Put the current span on {@code participant}'s lifeline.
     *
     * <p>Called from inside a {@code @WithSpan} method (the agent has already opened that span and
     * made it current) or from a controller method (where the current span is the SERVER span the
     * agent opened for the request) — in both cases {@code Span.current()} is the span whose arrow
     * the reader will see.
     */
    static void name(String participant) {
        Span.current().setAttribute(PARTICIPANT, participant);
    }
}
