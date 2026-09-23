package victor.training.notification;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Pretends to text the owner: no gateway, no credentials — the SMS is a log line.
 *
 * <p>The span still names the lifeline it belongs on ({@code genseq.participant}, read by
 * petclinic-test's trace-to-puml.ts), so the generated sequence diagrams draw the gateway as the
 * external actor it would be, and not as one more self-call inside this service.
 */
@Component
public class SmsGateway {
    private static final Logger log = LoggerFactory.getLogger(SmsGateway.class);
    private static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");

    @WithSpan("send-sms")
    public void send(String phone, String text) {
        Span.current().setAttribute(PARTICIPANT, "SMS gateway");
        log.info("SMS to {}: {}", phone, text);
    }
}
