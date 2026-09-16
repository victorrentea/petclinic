package victor.training.petclinic.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VisitDateRangeTest {

    private final LocalDate petBirthDate = LocalDate.of(2020, 1, 1);

    @Test
    void nullVisitDate_isAllowed() {
        assertThatCode(() -> VisitDateRange.check(null, petBirthDate)).doesNotThrowAnyException();
    }

    @Test
    void nullPetBirthDate_skipsLowerBoundCheck() {
        assertThatCode(() -> VisitDateRange.check(LocalDate.of(1900, 1, 1), null)).doesNotThrowAnyException();
    }

    @Test
    void visitDateWithinRange_isAllowed() {
        assertThatCode(() -> VisitDateRange.check(LocalDate.now(), petBirthDate)).doesNotThrowAnyException();
    }

    @Test
    void visitDateBeforePetBirthDate_throws() {
        LocalDate tooEarly = petBirthDate.minusDays(1);

        assertThatThrownBy(() -> VisitDateRange.check(tooEarly, petBirthDate))
                .isInstanceOf(VisitDateOutOfRangeException.class)
                .hasMessageContaining("predates the pet's birth date");
    }

    @Test
    void visitDateMoreThanOneYearInFuture_throws() {
        LocalDate tooLate = LocalDate.now().plusYears(1).plusDays(1);

        assertThatThrownBy(() -> VisitDateRange.check(tooLate, petBirthDate))
                .isInstanceOf(VisitDateOutOfRangeException.class)
                .hasMessageContaining("more than one year in the future");
    }

    @Test
    void visitDateExactlyOneYearInFuture_isAllowed() {
        LocalDate maxDate = LocalDate.now().plusYears(1);

        assertThatCode(() -> VisitDateRange.check(maxDate, petBirthDate)).doesNotThrowAnyException();
    }
}
