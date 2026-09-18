package victor.training.petclinic.notification;

import io.opentelemetry.instrumentation.annotations.WithSpan;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;

/**
 * Pretends to text the owner — by POSTing the SMS to {@link FakeSmsGatewayController}, over HTTP,
 * on this application's own port.
 *
 * <p>What is real is the <b>shape in the trace</b>. The call into this module opens a span that
 * declares which lifeline it belongs on, and the call out of it is an actual request, so the
 * sequence diagrams generated from those traces draw:
 *
 * <pre>
 *     Backend               -&gt; "Notification module" : notify-visit-booked
 *     "Notification module" -&gt; "SMS gateway"         : POST /api/fake-sms
 *     "SMS gateway"        --&gt; "Notification module" : 200
 * </pre>
 *
 * <p>The second arrow used to be a {@code @WithSpan} on a private method, which drew the same
 * shape while nothing left the JVM. Making it a request buys the one thing the picture could not
 * otherwise claim: the agent injects W3C {@code traceparent} on the way out and reads it back on
 * the way in, so the two ends of the arrow are provably one trace across a socket. It costs
 * nothing to run — the server answering is the one that asked.
 *
 * <p>The agent opens the CLIENT span for that request, and no application code can put an
 * attribute on it (it is created inside the JDK HTTP client, below any interceptor). It does not
 * need one: an HTTP CLIENT span is the <em>caller's</em> outgoing call, so the generator draws it
 * on the caller's lifeline and lets only the SERVER span cross — which is how a single call stays
 * a single arrow.
 */
@Component
public class FakeSmsNotificationSender implements NotificationSender, ApplicationListener<WebServerInitializedEvent> {

    private final RestClient restClient;

    /** The port this application answers on, learned from the server that opened it. */
    private volatile int port;

    FakeSmsNotificationSender(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    /**
     * Not {@code @Value("${server.port}")}: that is what was <em>asked for</em> — 0 under
     * {@code webEnvironment = RANDOM_PORT}, and the wrong number the moment anything overrides it.
     * The event carries what the server actually bound.
     */
    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        if (event.getApplicationContext().getServerNamespace() == null) {
            port = event.getWebServer().getPort(); // the application's server, not the management one
        }
    }

    @Override
    @WithSpan("notify-visit-booked")
    public void visitBooked(String ownerPhone, String petName, LocalDate visitDate) {
        Lifeline.name(Lifeline.NOTIFICATION_MODULE);
        restClient.post()
                // The path is not a {…} variable: RestClient percent-encodes what it expands,
                // and `/api/fake-sms` would go out as `%2Fapi%2Ffake-sms`.
                .uri("http://localhost:{port}" + FakeSmsGatewayController.PATH, port())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new FakeSmsGatewayController.Sms(ownerPhone,
                        "Visit for %s booked on %s. Reply STOP to unsubscribe.".formatted(petName, visitDate)))
                .retrieve()
                .toBodilessEntity();
    }

    private int port() {
        if (port == 0) {
            throw new IllegalStateException("No HTTP port: the fake SMS gateway is an endpoint of this "
                    + "application, so a test that books a visit needs a server running — "
                    + "@SpringBootTest(webEnvironment = RANDOM_PORT), not the default MOCK");
        }
        return port;
    }
}
