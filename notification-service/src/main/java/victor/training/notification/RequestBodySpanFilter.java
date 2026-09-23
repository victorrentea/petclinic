package victor.training.notification;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

/**
 * Puts the JSON this service was sent on its SERVER span, as {@code http.request.body}.
 *
 * <p>No OTel agent records payloads. For the calls the browser makes, petclinic-frontend's
 * otel.ts captures them on the XHR span; a call from the backend has no browser on it, and
 * this end is the one place its body is in hand. petclinic-test's trace-to-puml.ts reads
 * the attribute off the span the arrow is drawn from, so the
 * {@code Backend -> NotificationService} arrow gets the ⊕ that unfolds the payload, like a
 * call from the browser does.
 */
@Component
class RequestBodySpanFilter extends OncePerRequestFilter {
    private static final int MAX_BODY_BYTES = 4000; // about the cap otel.ts applies in the browser

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        ContentCachingRequestWrapper cached = new ContentCachingRequestWrapper(request, MAX_BODY_BYTES);
        try {
            chain.doFilter(cached, response);
        } finally {
            // Read after the chain: the wrapper only holds what the controller consumed.
            String body = new String(cached.getContentAsByteArray(), StandardCharsets.UTF_8);
            if (!body.isEmpty()) {
                Span.current().setAttribute("http.request.body", body);
            }
        }
    }
}
