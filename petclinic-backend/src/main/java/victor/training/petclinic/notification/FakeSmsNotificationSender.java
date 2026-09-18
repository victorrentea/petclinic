package victor.training.petclinic.notification;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Pretends to text the owner: no gateway, no credentials, no HTTP — the SMS is a log line.
 *
 * <p>What is real is the <b>shape in the trace</b>. Both methods open a span that declares which
 * lifeline it belongs on, so the sequence diagrams generated from those traces draw this module as
 * a participant of its own rather than as two more self-hops inside {@code Backend}:
 *
 * <pre>
 *     Backend              -&gt; "Notification module" : notify-visit-booked
 *     "Notification module" -&gt; "SMS gateway"         : send-sms
 * </pre>
 *
 * <p>{@code genseq.participant} is the existing contract the generator already reads to keep a
 * {@code @SpringBootTest}'s own sentences off the application's lifeline — see
 * {@code victor.training.petclinic.genseq.Steps} and
 * {@code petclinic-test/src/genseq/trace-to-puml.ts}. Nothing else in a trace could separate the
 * two: the module runs in the same JVM under the same {@code service.name} as its caller, and the
 * SMS gateway is not even a process. Naming the lifeline is the only thing that can say so.
 */
@Component
public class FakeSmsNotificationSender implements NotificationSender {
    private static final Logger log = LoggerFactory.getLogger(FakeSmsNotificationSender.class);

    /** The lifeline a span is drawn on. Read by petclinic-test's trace-to-puml.ts. */
    private static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");

    private static final String MODULE = "Notification module";

    /** The thing being called, drawn as the actor it would be if the call were real. */
    private static final String SMS_GATEWAY = "SMS gateway";

    @Override
    @WithSpan("notify-visit-booked")
    public void visitBooked(String ownerPhone, String petName, LocalDate visitDate) {
        Span.current().setAttribute(PARTICIPANT, MODULE);
        sendSms(ownerPhone, "Visit for %s booked on %s. Reply STOP to unsubscribe."
                .formatted(petName, visitDate));
    }

    // Private and self-invoked on purpose: the OTel Java agent instruments @WithSpan in the
    // bytecode, so the span is opened where Spring AOP would see nothing to proxy — the same
    // trade the controllers' `book-visit` span already makes.
    @WithSpan("send-sms")
    private void sendSms(String phone, String text) {
        Span.current().setAttribute(PARTICIPANT, SMS_GATEWAY);
        log.info("SMS to {}: {}", phone, text);
    }
}
