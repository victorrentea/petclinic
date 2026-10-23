package victor.training.petclinic.domain;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import jakarta.validation.ValidationException;

import org.junit.jupiter.api.Test;

class PetVisitDateTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(2020, 3, 1);
    private final Pet pet = new Pet();

    PetVisitDateTest() {
        pet.setBirthDate(BIRTH_DATE);
    }

    @Test
    void acceptsTheDayThePetWasBorn() {
        assertThatCode(() -> pet.checkVisitDate(BIRTH_DATE)).doesNotThrowAnyException();
    }

    @Test
    void acceptsExactlyOneYearFromToday() {
        assertThatCode(() -> pet.checkVisitDate(LocalDate.now().plusYears(1))).doesNotThrowAnyException();
    }

    @Test
    void refusesTheDayBeforeBirth() {
        assertThatThrownBy(() -> pet.checkVisitDate(BIRTH_DATE.minusDays(1)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("birth date (2020-03-01)");
    }

    @Test
    void refusesMoreThanOneYearAhead() {
        assertThatThrownBy(() -> pet.checkVisitDate(LocalDate.now().plusYears(1).plusDays(1)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("one year");
    }

    @Test
    void leavesAMissingDateToTheOtherChecks() {
        assertThatCode(() -> pet.checkVisitDate(null)).doesNotThrowAnyException();
    }

    @Test
    void hasNoLowerBoundWithoutABirthDate() {
        pet.setBirthDate(null);
        assertThatCode(() -> pet.checkVisitDate(LocalDate.of(9, 7, 20))).doesNotThrowAnyException();
    }
}
