package victor.training.petclinic.domain;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

/** Issue #40: a visit falls between the pet's birth and one year from today. */
class PetVisitDateTest {
    private final Pet axel = new Pet();

    PetVisitDateTest() {
        axel.setName("Axel");
        axel.setBirthDate(LocalDate.parse("2024-05-10"));
    }

    @Test
    void refusesADateBeforeBirth() {
        assertThatThrownBy(() -> axel.checkVisitDate(LocalDate.parse("2024-05-09")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("before Axel's birth date 2024-05-10");
    }

    @Test
    void refusesADateMoreThanOneYearAhead() {
        assertThatThrownBy(() -> axel.checkVisitDate(LocalDate.now().plusYears(1).plusDays(1)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("more than one year ahead");
    }

    @Test
    void leavesAMissingDateToTheRequiredCheck() {
        assertThatCode(() -> axel.checkVisitDate(null)).doesNotThrowAnyException();
    }

    @Test
    void aPetWithNoBirthDateHasNoEarliestVisit() {
        axel.setBirthDate(null);

        assertThatCode(() -> axel.checkVisitDate(LocalDate.parse("0009-07-20"))).doesNotThrowAnyException();
    }
}
