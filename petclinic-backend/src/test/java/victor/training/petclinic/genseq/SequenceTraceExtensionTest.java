package victor.training.petclinic.genseq;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class SequenceTraceExtensionTest {

    @Test
    void selectsByTheSameSyntaxDashDTestTakes() {
        String select = "SequenceTraceExtensionTest#a+b,victor.training.petclinic.genseq.Steps#c";

        assertThat(SequenceTraceExtension.selects(select, SequenceTraceExtensionTest.class, "a")).isTrue();
        assertThat(SequenceTraceExtension.selects(select, SequenceTraceExtensionTest.class, "b")).isTrue();
        assertThat(SequenceTraceExtension.selects(select, Steps.class, "c")).isTrue();
        assertThat(SequenceTraceExtension.selects(select, SequenceTraceExtensionTest.class, "c")).isFalse();
        assertThat(SequenceTraceExtension.selects(select, Rest.class, "a")).isFalse();
    }

    @Test
    void aClassWithoutAMethodSelectsAllOfIt_andANestedTestBelongsToItsOuterClass() {
        assertThat(SequenceTraceExtension.selects("SequenceTraceExtensionTest", Inner.class, "x")).isTrue();
        assertThat(SequenceTraceExtension.selects(" SequenceTraceExtensionTest#x ", Inner.class, "x")).isTrue();
    }

    @Nested
    class Inner {
    }
}
