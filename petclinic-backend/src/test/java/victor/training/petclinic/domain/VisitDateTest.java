package victor.training.petclinic.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VisitDateTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(2018, 8, 6);

    @Test
    void acceptsADateInsideTheRange() {
        assertThatCode(() -> Visit.validateDate(LocalDate.now().plusDays(7), BIRTH_DATE))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsADateBeforeThePetWasBorn() {
        assertThatThrownBy(() -> Visit.validateDate(BIRTH_DATE.minusDays(1), BIRTH_DATE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("before the pet was born");
    }

    @Test
    void rejectsADateMoreThanAYearAhead() {
        LocalDate tooFar = LocalDate.now().plusYears(Visit.MAX_YEARS_AHEAD).plusDays(1);

        assertThatThrownBy(() -> Visit.validateDate(tooFar, BIRTH_DATE))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("year ahead");
    }

    @Test
    void leavesTheLowerBoundOpenWhenTheBirthDateIsUnknown() {
        assertThatCode(() -> Visit.validateDate(LocalDate.of(1990, 1, 1), null))
                .doesNotThrowAnyException();
    }

    @Test
    void ignoresAMissingDate() {
        assertThatCode(() -> Visit.validateDate(null, BIRTH_DATE)).doesNotThrowAnyException();
    }
}
