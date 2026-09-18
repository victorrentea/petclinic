package victor.training.petclinic.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.DisplayNameGeneration;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import victor.training.petclinic.tools.PrettyTestNames;

/**
 * The rule of issue #40, away from HTTP and the database: a visit is dated between the pet's
 * birth and one year from today.
 * <p>
 * "Today" is a parameter rather than a clock read inside, which is what lets the boundaries be
 * tested at all — and why the production code needs no Clock bean and the application no
 * endpoint for moving time, which petclinic-test/src/no-reset-endpoint.spec.ts would object to.
 */
@DisplayNameGeneration(PrettyTestNames.class)
class VisitDateRangeTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 10);
    private static final LocalDate BORN = LocalDate.of(2020, 3, 1);

    private final VisitDateRange range = VisitDateRange.forPetBornOn(BORN, TODAY);

    @Nested
    class TheLowerBound {
        @Test
        void refusesTheDayBeforeThePetWasBorn() {
            assertThat(range.allows(BORN.minusDays(1))).isFalse();
        }

        @Test
        void allowsTheBirthDayItself() {
            assertThat(range.allows(BORN)).isTrue();
        }

        @Test
        void isOpenWhenThePetsBirthDateIsUnknown() {
            VisitDateRange unknownBirth = VisitDateRange.forPetBornOn(null, TODAY);
            assertThat(unknownBirth.allows(LocalDate.of(1900, 1, 1))).isTrue();
        }
    }

    @Nested
    class TheUpperBound {
        @Test
        void allowsExactlyOneYearFromToday() {
            assertThat(range.allows(TODAY.plusYears(1))).isTrue();
        }

        @Test
        void refusesOneDayPastThat() {
            assertThat(range.allows(TODAY.plusYears(1).plusDays(1))).isFalse();
        }

        @Test
        void staysOpenForTheWholeYearAheadEvenForAPetBornToday() {
            VisitDateRange newborn = VisitDateRange.forPetBornOn(TODAY, TODAY);
            assertThat(newborn.allows(TODAY.plusMonths(6))).isTrue();
        }
    }

    @Test
    void refusesNoDateAtAll() {
        assertThat(range.allows(null)).isFalse();
    }

    @Test
    void saysWhatItAllowsSoTheApiCanExplainTheRefusal() {
        assertThat(range.toString()).contains("2020-03-01").contains("2027-09-10");
    }
}
