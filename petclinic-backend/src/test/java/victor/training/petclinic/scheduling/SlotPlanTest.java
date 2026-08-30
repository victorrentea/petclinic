package victor.training.petclinic.scheduling;

import org.junit.jupiter.api.Test;

import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SlotPlanTest {

    @Test
    void splitsTheDayIntoBackToBackSlots() {
        assertThat(SlotPlan.startTimes(LocalTime.of(9, 0), LocalTime.of(10, 30), 30))
                .containsExactly(LocalTime.of(9, 0), LocalTime.of(9, 30), LocalTime.of(10, 0));
    }

    @Test
    void dropsATrailingRemainderTooShortForAWholeSlot() {
        assertThat(SlotPlan.startTimes(LocalTime.of(9, 0), LocalTime.of(10, 20), 30))
                .containsExactly(LocalTime.of(9, 0), LocalTime.of(9, 30));
    }

    @Test
    void yieldsNothingWhenTheWindowIsShorterThanOneSlot() {
        assertThat(SlotPlan.startTimes(LocalTime.of(9, 0), LocalTime.of(9, 20), 30)).isEmpty();
    }

    @Test
    void stopsAtMidnightInsteadOfWrappingIntoTheNextDay() {
        // 23:30 would end at 00:00, which LocalTime cannot express as "later than 23:30"
        assertThat(SlotPlan.startTimes(LocalTime.of(23, 0), LocalTime.MAX, 30))
                .containsExactly(LocalTime.of(23, 0));
    }

    @Test
    void rejectsANonPositiveSlotLength() {
        assertThatThrownBy(() -> SlotPlan.startTimes(LocalTime.of(9, 0), LocalTime.of(17, 0), 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("slotMinutes");
    }
}
