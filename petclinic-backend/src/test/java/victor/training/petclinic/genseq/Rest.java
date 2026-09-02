package victor.training.petclinic.genseq;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.context.Scope;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.servlet.HandlerMapping;

/**
 * A MockMvc call that carries its own payloads onto the diagram.
 *
 * Neither the OpenTelemetry Java agent nor the web instrumentations record HTTP bodies, so the
 * browser suites capture them themselves — in `petclinic-frontend/src/otel.ts`, on the frontend's
 * CLIENT span, which is the parent of the backend's SERVER span. That is the shape the renderer
 * reads (`bodyOf` in trace-to-puml.ts looks at the arrow's span and at its parent), and it is
 * exactly the shape reproduced here: the call runs inside a CLIENT span that holds the request
 * body, the response body and the status.
 * <p>
 * Nothing in the renderer had to learn about @SpringBootTest for this. Drop the wrapper and the
 * diagram loses its ⊕ on the REST arrows and keeps everything else — which is the test that this
 * really is the same mechanism and not a parallel one.
 */
public final class Rest {

    /** Same ceiling the browser applies, so one side of a comparison cannot be quietly fuller. */
    private static final int MAX_BODY_CHARS = 4000;

    private Rest() {
    }

    /**
     * Perform the request with the payloads captured. Use in place of
     * <code>mockMvc.perform(…)</code> in a {@link GenerateSequence} test; anywhere else it is an
     * ordinary <code>perform</code> wrapped in a span nobody exports.
     */
    public static ResultActions call(MockMvc mockMvc, RequestBuilder request) throws Exception {
        // Named on the way out, not here: the route template is only known once Spring has
        // matched a handler, and `GET /api/owners/{ownerId}` — not the concrete URI — is what
        // makes the arrow label match the browser diagrams and resolve against openapi.yaml.
        Span span = GlobalOpenTelemetry.getTracer("petclinic-genseq")
                .spanBuilder("http")
                .setSpanKind(SpanKind.CLIENT)
                .startSpan();
        try (Scope ignored = span.makeCurrent()) {
            // Current for the duration, so the agent's SERVER span for this call becomes its
            // child — the same parentage the browser's fetch span has.
            ResultActions actions = mockMvc.perform(request);
            describe(span, actions.andReturn());
            return actions;
        } finally {
            span.end();
        }
    }

    private static void describe(Span span, MvcResult result) throws Exception {
        MockHttpServletRequest request = result.getRequest();
        MockHttpServletResponse response = result.getResponse();
        span.updateName(request.getMethod() + " " + route(request));
        span.setAttribute("http.status_code", String.valueOf(response.getStatus()));
        put(span, "http.request.body", request.getContentAsString());
        put(span, "http.response.body", response.getContentAsString());
    }

    /**
     * The route as the contract writes it — <code>/api/owners/{ownerId}</code>. Spring leaves the
     * matched pattern on the request; without it the arrow would carry one run's concrete ids and
     * two runs of the same scenario would render as different diagrams.
     */
    private static String route(MockHttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return pattern != null ? pattern.toString() : request.getRequestURI();
    }

    private static void put(Span span, String key, String value) {
        if (value == null || value.isEmpty()) {
            return; // an empty body is not a payload: a 201 with no content has nothing to reveal
        }
        span.setAttribute(key, value.length() <= MAX_BODY_CHARS
                ? value
                : value.substring(0, MAX_BODY_CHARS) + "…");
    }
}
