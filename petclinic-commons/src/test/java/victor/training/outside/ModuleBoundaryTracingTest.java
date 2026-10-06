package victor.training.outside;

import static org.assertj.core.api.Assertions.assertThat;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.sdk.testing.junit5.OpenTelemetryExtension;
import io.opentelemetry.sdk.trace.data.SpanData;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import victor.training.commons.HomeCountry;
import victor.training.commons.PhoneNumbers;
import victor.training.commons.VisitBookedNotification;

/** Calls commons from outside its package, as the apps do: each crossing is a span, nothing else is. */
class ModuleBoundaryTracingTest {
    private static final AttributeKey<String> PARTICIPANT = AttributeKey.stringKey("genseq.participant");
    private static final AttributeKey<String> STEREOTYPE = AttributeKey.stringKey("genseq.stereotype");
    private static final AttributeKey<String> NAMESPACE = AttributeKey.stringKey("code.namespace");
    private static final AttributeKey<String> FUNCTION = AttributeKey.stringKey("code.function");
    private static final AttributeKey<String> ARGS = AttributeKey.stringKey("boundary.args");
    private static final AttributeKey<String> RETURN = AttributeKey.stringKey("boundary.return");

    @RegisterExtension
    static final OpenTelemetryExtension otel = OpenTelemetryExtension.create();

    @Test
    void aCallIntoCommonsIsASpanOnTheModuleLifelineButTheCallsInsideItAreNot() {
        PhoneNumbers.normalize("+1 (608) 555-1023");

        assertThat(otel.getSpans()).singleElement().satisfies(span -> {
            assertThat(span.getName()).isEqualTo("PhoneNumbers.normalize");
            assertThat(span.getAttributes().get(PARTICIPANT)).isEqualTo("Commons");
            assertThat(span.getAttributes().get(STEREOTYPE)).isEqualTo("module");
            assertThat(span.getAttributes().get(NAMESPACE)).isEqualTo(PhoneNumbers.class.getName());
            assertThat(span.getAttributes().get(FUNCTION)).isEqualTo("normalize");
            assertThat(span.getAttributes().get(ARGS)).isEqualTo("[+1 (608) 555-1023]");
            assertThat(span.getAttributes().get(RETURN)).isEqualTo("+16085551023");
        });
    }

    @Test
    void aCallFromCommonsBackOutIsASpanNestedInTheOneThatEntered() {
        PhoneNumbers.normalize("8474461990", new Clinic());

        SpanData entered = span("PhoneNumbers.normalize");
        SpanData left = span("Clinic.homeDialCode");
        assertThat(left.getParentSpanId()).isEqualTo(entered.getSpanId());
        assertThat(left.getAttributes().get(PARTICIPANT)).as("drawn on its caller's own lifeline").isNull();
        assertThat(left.getAttributes().get(NAMESPACE)).isEqualTo(Clinic.class.getName());
        assertThat(left.getAttributes().get(FUNCTION)).isEqualTo("homeDialCode");
    }

    @Test
    void reEnteringCommonsFromAppCodeIsACrossingAgain() {
        HomeCountry asksCommonsBack = () -> PhoneNumbers.normalize("+1");
        PhoneNumbers.normalize("8474461990", asksCommonsBack);

        assertThat(otel.getSpans()).extracting(SpanData::getName)
                .containsExactlyInAnyOrder(
                        "PhoneNumbers.normalize", "HomeCountry.homeDialCode", "PhoneNumbers.normalize");
    }

    @Test
    void readingASharedRecordIsNotACallIntoTheModule() {
        new VisitBookedNotification("+16085551023", "Leo", LocalDate.of(2026, 10, 1)).ownerPhone();

        assertThat(otel.getSpans()).isEmpty();
    }

    private static SpanData span(String name) {
        return otel.getSpans().stream().filter(s -> s.getName().equals(name)).findFirst().orElseThrow();
    }

    static class Clinic implements HomeCountry {
        @Override
        public String homeDialCode() {
            return "+1";
        }
    }
}
