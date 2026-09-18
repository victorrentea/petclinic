package victor.training.petclinic.notification;

import io.swagger.v3.oas.annotations.Hidden;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * The SMS gateway, faked as an HTTP endpoint of this very application.
 *
 * <p>Still no gateway, no credentials and no SMS — the text is a log line, exactly as before. What
 * changed is that {@link FakeSmsNotificationSender} now <b>reaches it over the network</b> instead
 * of calling a private method, so the trace records the one thing an in-process call can never
 * show: the trace context travelling in a {@code traceparent} header and being picked up on the
 * other side. The generated diagram draws that hop as
 * {@code "Notification module" -> "SMS gateway": POST /api/fake-sms} — a real request, with a real
 * response arrow, rather than two self-hops inside {@code Backend}.
 *
 * <p>It answers on this application's own port because the point is the propagation, not a second
 * deployable: a trace that leaves a process and comes back into it crosses exactly the same
 * boundary as one that reaches a different host, and it does so without asking anybody to run a
 * second service before the diagrams can be regenerated.
 *
 * <p>{@code @Hidden} keeps it out of {@code openapi.yaml}: the contract describes the API this
 * application offers its clients, and nobody is a client of this. It also keeps the arrow's label
 * as the bare route — {@code petclinic-test/src/genseq/openapi-operations.ts} puts an operation's
 * name above its route only for operations the contract names.
 */
@Hidden
@RestController
public class FakeSmsGatewayController {

    /**
     * Shared with the sender so one edit moves both ends. Also spelled out, as a literal, in
     * {@code BasicAuthenticationConfig}: the security package may not depend on this one
     * (C3ArchTest and PackagesArchTest check the package graph against the drawn architecture).
     */
    public static final String PATH = "/api/fake-sms";

    private static final Logger log = LoggerFactory.getLogger(FakeSmsGatewayController.class);

    /** What a text is, to a gateway: a number and something to say. */
    public record Sms(String phone, String text) {
    }

    @PostMapping(PATH)
    public void receive(@RequestBody Sms sms) {
        // On the SERVER span the agent opened for this request — the span the arrow is drawn
        // from, and the far end of the hop the sender's CLIENT span started.
        Lifeline.name(Lifeline.SMS_GATEWAY);
        log.info("SMS to {}: {}", sms.phone(), sms.text());
    }
}
