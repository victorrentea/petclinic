package victor.training.petclinic.domain;

import jakarta.validation.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PetVisitDateTest {
    static final LocalDate BIRTH = LocalDate.parse("2020-03-01");
    static final LocalDate TODAY = LocalDate.parse("2026-09-10");

    Pet pet = aPetBornOn(BIRTH);

    @Test
    void acceptsTheBirthDay() {
        assertThatCode(() -> pet.checkVisitDate(BIRTH, TODAY)).doesNotThrowAnyException();
    }

    @Test
    void refusesTheDayBeforeBirth() {
        assertThatThrownBy(() -> pet.checkVisitDate(BIRTH.minusDays(1), TODAY))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("before Axel was born (2020-03-01)");
    }

    @Test
    void acceptsExactlyOneYearAhead() {
        assertThatCode(() -> pet.checkVisitDate(TODAY.plusYears(1), TODAY)).doesNotThrowAnyException();
    }

    @Test
    void refusesMoreThanOneYearAhead() {
        assertThatThrownBy(() -> pet.checkVisitDate(TODAY.plusYears(1).plusDays(1), TODAY))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("more than one year ahead (2027-09-10)");
    }

    @Test
    void checksOnlyTheUpperBoundWithoutABirthDate() {
        Pet unknownAge = aPetBornOn(null);
        assertThatCode(() -> unknownAge.checkVisitDate(LocalDate.parse("0009-07-20"), TODAY))
                .doesNotThrowAnyException();
    }

    private static Pet aPetBornOn(LocalDate birthDate) {
        Pet pet = new Pet();
        pet.setName("Axel");
        pet.setBirthDate(birthDate);
        return pet;
    }
}
