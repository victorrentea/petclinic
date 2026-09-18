package victor.training.petclinic.domain;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** petclinic-test/src/visit-date-range.feature, one layer down. */
class VisitDateRangeTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 10);
    private final Pet pet = petBornOn(LocalDate.of(2020, 3, 1));

    @Test
    void aVisitCannotPredateThePet() {
        assertThatThrownBy(() -> pet.checkVisitDate(LocalDate.of(2020, 2, 29), TODAY))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("before the pet was born");
    }

    @Test
    void aVisitCannotBeBookedMoreThanAYearAhead() {
        assertThatThrownBy(() -> pet.checkVisitDate(LocalDate.of(2027, 9, 11), TODAY))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("more than one year ahead");
    }

    @Test
    void bothEndsOfTheRangeAreAccepted() {
        assertThatCode(() -> pet.checkVisitDate(LocalDate.of(2020, 3, 1), TODAY)).doesNotThrowAnyException();
        assertThatCode(() -> pet.checkVisitDate(LocalDate.of(2027, 9, 10), TODAY)).doesNotThrowAnyException();
    }

    @Test
    void aPetWithNoBirthDateHasNoLowerBound() {
        assertThatCode(() -> petBornOn(null).checkVisitDate(LocalDate.of(9, 7, 20), TODAY))
                .doesNotThrowAnyException();
    }

    private static Pet petBornOn(LocalDate birthDate) {
        Pet pet = new Pet();
        pet.setBirthDate(birthDate);
        return pet;
    }
}
