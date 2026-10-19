package victor.training.petclinic.tools;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;

/**
 * No @DisplayNameGeneration here on purpose: this class reads as a sentence only because
 * junit-platform.properties makes PrettyTestNames the default. Drop that line and this fails.
 */
class PrettyTestNamesTest {

    private TestInfo info;

    @BeforeEach
    void captureTheRunningTest(TestInfo info) {
        this.info = info;
    }

    @Test
    void everyTestReadsAsASentence_withoutOptingIn() {
        assertThat(info.getDisplayName()).isEqualTo("every test reads as a sentence without opting in");
    }
}
