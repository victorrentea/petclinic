package victor.training.petclinic.domain;

import java.time.LocalDate;

/**
 * The allowed window for a visit date: from the pet's birth (inclusive) to one year from today
 * (inclusive). Shared by create and update so the rule holds regardless of entry point.
 */
public final class VisitDateRange {

    private VisitDateRange() {
    }

    public static void check(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            return; // @NotNull/@Nullable handling elsewhere reports a missing date
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw new VisitDateOutOfRangeException(
                    "Visit date " + visitDate + " predates the pet's birth date " + petBirthDate);
        }
        LocalDate maxDate = LocalDate.now().plusYears(1);
        if (visitDate.isAfter(maxDate)) {
            throw new VisitDateOutOfRangeException(
                    "Visit date " + visitDate + " is more than one year in the future (max " + maxDate + ")");
        }
    }
}
