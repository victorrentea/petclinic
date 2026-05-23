package jdkdebug;

import org.junit.jupiter.api.Test;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Demo prompt to re-run this kind of investigation:
 *
 *   "JDI breakpoint demo on this test: run it via `./mvnw surefire:test
 *    -Dtest=JdkInternalsTest -Dmaven.surefire.debug` to open port 5005,
 *    then attach a small JDI client that sets ONE breakpoint inside the
 *    filter lambda (line of the `n -> ...` expression) and prints the
 *    local variables plus the full stack trace at that point."
 *
 * Companion client: {@link Tracer} (~80 lines). Run with:
 *   java -cp target/test-classes jdkdebug.Tracer 5005 &lt;lambda-line&gt;
 */
class JdkInternalsTest {

    @Test
    void streamPipeline() {
        int sum = Stream.of(1, 2, 3, 4)
                .filter(n -> n % 2 == 0)   // ← Tracer breakpoints inside this lambda
                .mapToInt(Integer::intValue)
                .sum();

        assertThat(sum).isEqualTo(6);
    }
}
