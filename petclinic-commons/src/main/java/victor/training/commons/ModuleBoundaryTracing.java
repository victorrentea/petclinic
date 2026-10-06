package victor.training.commons;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanBuilder;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Scope;
import java.util.Arrays;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;

/**
 * A span for every call that crosses this jar's boundary, in either direction: an app calling
 * into commons, and commons calling back out into app code it was handed. A call that stays on
 * one side gets none.
 *
 * <p>Woven into this jar at build time, so the apps change nothing. Without the OpenTelemetry
 * agent, {@link GlobalOpenTelemetry} is a no-op and so is every span here.
 */
@Aspect
public class ModuleBoundaryTracing {
    /** The lifeline petclinic-test's trace-to-puml.ts draws a span on, and what kind of thing it is. */
    private static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");
    private static final AttributeKey<String> STEREOTYPE = AttributeKey.stringKey("genseq.stereotype");
    /** Where the method is, as the agent stamps its own spans: the diagram links the arrow to it. */
    private static final AttributeKey<String> NAMESPACE = AttributeKey.stringKey("code.namespace");
    private static final AttributeKey<String> FUNCTION = AttributeKey.stringKey("code.function");
    private static final String APPS = "victor.training.";
    private static final String COMMONS = "victor.training.commons.";

    // execution() is woven into the callee, which cannot see its caller. This flag is how a
    // commons method tells a call from an app (a crossing) from a call by commons itself.
    private static final ThreadLocal<Boolean> INSIDE = ThreadLocal.withInitial(() -> false);

    // A record is the data both sides exchange: reading one is not a call into the module.
    @Around("execution(* victor.training.commons..*(..)) && !within(java.lang.Record+)"
            + " && !within(victor.training.commons.ModuleBoundaryTracing)")
    public Object enter(ProceedingJoinPoint call) throws Throwable {
        if (INSIDE.get()) {
            return call.proceed();
        }
        return traced(call, call.getSignature().getDeclaringType(), true);
    }

    @Around("call(* *(..)) && within(victor.training.commons..*)"
            + " && !within(victor.training.commons.ModuleBoundaryTracing)")
    public Object leave(ProceedingJoinPoint call) throws Throwable {
        Object callee = call.getTarget();
        if (callee == null || !isAppCode(callee.getClass())) {
            return call.proceed(); // the JDK, or commons itself
        }
        // a lambda's class is hidden and named like Foo$$Lambda/0x…: the interface reads better
        Class<?> type = callee.getClass().isHidden() ? call.getSignature().getDeclaringType() : callee.getClass();
        return traced(call, type, false);
    }

    private static boolean isAppCode(Class<?> type) {
        return type.getName().startsWith(APPS) && !type.getName().startsWith(COMMONS);
    }

    private static Object traced(ProceedingJoinPoint call, Class<?> type, boolean entering) throws Throwable {
        String method = call.getSignature().getName();
        SpanBuilder builder = GlobalOpenTelemetry.getTracer("petclinic-commons")
                .spanBuilder(type.getSimpleName() + "." + method)
                .setAttribute(NAMESPACE, type.getName())
                .setAttribute(FUNCTION, method)
                .setAttribute("boundary.args", Arrays.toString(call.getArgs()));
        if (entering) { // leaving: drawn on the caller's own lifeline
            builder.setAttribute(PARTICIPANT, "Commons").setAttribute(STEREOTYPE, "module");
        }
        Span span = builder.startSpan();
        boolean wasInside = INSIDE.get();
        INSIDE.set(entering);
        try (Scope ignored = span.makeCurrent()) {
            Object result = call.proceed();
            if (result != null) {
                span.setAttribute("boundary.return", result.toString());
            }
            return result;
        } catch (Throwable e) {
            span.recordException(e);
            span.setStatus(StatusCode.ERROR);
            throw e;
        } finally {
            INSIDE.set(wasInside);
            span.end();
        }
    }
}
