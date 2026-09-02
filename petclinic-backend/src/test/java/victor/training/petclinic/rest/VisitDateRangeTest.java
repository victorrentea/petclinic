package victor.training.petclinic.rest;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.rest.error.VisitDateOutOfRangeException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rule on its own — no Spring, no database. The REST tests in VisitTest prove
 * every entry point calls it; these prove what it decides.
 */
class VisitDateRangeTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(2018, 12, 23);

    private final VisitDateRange range = new VisitDateRange();
    private Pet pet;

    @BeforeEach
    void setUp() {
        pet = new Pet();
        pet.setBirthDate(BIRTH_DATE);
    }

    @Test
    void rejectsADateBeforeThePetWasBorn() {
        assertThatThrownBy(() -> range.check(BIRTH_DATE.minusDays(1), pet))
                .isInstanceOf(VisitDateOutOfRangeException.class)
                .hasMessageContaining("birth date")
                .hasMessageContaining(BIRTH_DATE.toString());
    }

    @Test
    void rejectsTheAbsurdYearFromIssue40() {
        assertThatThrownBy(() -> range.check(LocalDate.of(9, 7, 20), pet))
                .isInstanceOf(VisitDateOutOfRangeException.class)
                .hasMessageContaining("birth date");
    }

    @Test
    void acceptsTheBirthDateItself() {
        assertThatCode(() -> range.check(BIRTH_DATE, pet)).doesNotThrowAnyException();
    }

    @Test
    void acceptsAPastVisitAfterTheBirthDate() {
        assertThatCode(() -> range.check(LocalDate.now().minusYears(1), pet)).doesNotThrowAnyException();
    }

    @Test
    void acceptsExactlyOneYearAhead() {
        assertThatCode(() -> range.check(LocalDate.now().plusYears(1), pet)).doesNotThrowAnyException();
    }

    @Test
    void rejectsMoreThanOneYearAhead() {
        assertThatThrownBy(() -> range.check(LocalDate.now().plusYears(1).plusDays(1), pet))
                .isInstanceOf(VisitDateOutOfRangeException.class)
                .hasMessageContaining("year in the future");
    }

    @Test
    void ignoresAMissingDate() {
        assertThatCode(() -> range.check(null, pet)).doesNotThrowAnyException();
    }

    @Test
    void skipsTheLowerBoundWhenThePetHasNoBirthDate() {
        pet.setBirthDate(null);
        assertThatCode(() -> range.check(LocalDate.of(9, 7, 20), pet)).doesNotThrowAnyException();
    }
}
