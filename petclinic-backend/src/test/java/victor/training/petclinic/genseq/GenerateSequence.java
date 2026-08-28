package victor.training.petclinic.genseq;

import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.extension.ExtendWith;

/**
 * The Java twin of the <code>@generate_sequence</code> tag the .feature and .spec.ts tests carry:
 * put it on a @SpringBootTest and every test method in it is captured as a trace and drawn as a
 * PlantUML sequence diagram next to the test — <code>OwnerSequenceTest.java.genseq.puml</code>.
 * <p>
 * Nothing happens unless the OpenTelemetry Java agent is attached and Tempo is up, which is what
 * <code>./run-tests-with-tracing.sh</code> arranges (mvn -Pgenseq). Under a plain <code>mvn test</code>
 * the tracer is a no-op, the annotation costs nothing, and the test is an ordinary test.
 * <p>
 * Why a @SpringBootTest is worth drawing at all, when the browser tests are already drawn: it is the
 * cheapest test that still exercises the real controller, the real transaction boundaries and the
 * real Hibernate session — so the N+1 the browser diagram shows is reproducible in a diagram that
 * needs no Angular, no Chromium and no running server, and the two pictures can be put side by side.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Inherited
@ExtendWith(SequenceTraceExtension.class)
// Also a tag, so the runner can ask for exactly these tests (mvn -Dgroups=genseq) without
// anyone having to keep a list of class names in a shell script in step with the annotation.
@Tag(GenerateSequence.TAG)
public @interface GenerateSequence {

    String TAG = "genseq";
}
