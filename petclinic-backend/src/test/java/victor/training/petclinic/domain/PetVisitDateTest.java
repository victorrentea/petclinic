package victor.training.petclinic.domain;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PetVisitDateTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(2018, 12, 24);
    private static final LocalDate TODAY = LocalDate.now();

    private final Pet pet = new Pet();
    {
        pet.setBirthDate(BIRTH_DATE);
    }

    @Test
    void acceptsTheBirthDate() {
        assertThatCode(() -> pet.checkVisitDate(BIRTH_DATE)).doesNotThrowAnyException();
    }

    @Test
    void acceptsExactlyOneYearAhead() {
        assertThatCode(() -> pet.checkVisitDate(TODAY.plusYears(1))).doesNotThrowAnyException();
    }

    @Test
    void rejectsADateBeforeTheBirthDate() {
        assertThatThrownBy(() -> pet.checkVisitDate(BIRTH_DATE.minusDays(1)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("birth date (2018-12-24)");
    }

    @Test
    void rejectsYear9() {
        assertThatThrownBy(() -> pet.checkVisitDate(LocalDate.of(9, 7, 20)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void rejectsMoreThanOneYearAhead() {
        assertThatThrownBy(() -> pet.checkVisitDate(TODAY.plusYears(1).plusDays(1)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("1 year");
    }

    @Test
    void withoutABirthDateOnlyTheUpperBoundApplies() {
        pet.setBirthDate(null);
        assertThatCode(() -> pet.checkVisitDate(LocalDate.of(1990, 1, 1))).doesNotThrowAnyException();
    }
}
