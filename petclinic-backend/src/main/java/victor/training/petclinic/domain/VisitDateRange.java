package victor.training.petclinic.domain;

import java.time.LocalDate;

/**
 * Bug #40: a visit date may neither predate the pet nor be booked far into the future.
 * The frontend applies the same bounds to its datepicker; this is the enforcement.
 */
public final class VisitDateRange {
    public static final int MAX_YEARS_AHEAD = 1;

    private VisitDateRange() {
        // static-only
    }

    public static LocalDate earliest(LocalDate petBirthDate) {
        return petBirthDate;
    }

    public static LocalDate latest() {
        return LocalDate.now().plusYears(MAX_YEARS_AHEAD);
    }

    public static void validate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            return; // absence of a date is a separate concern
        }
        LocalDate latest = latest();
        if (petBirthDate != null && visitDate.isBefore(earliest(petBirthDate))) {
            throw new IllegalArgumentException(
                    "Visit date " + visitDate + " is before the pet was born (" + petBirthDate + ")");
        }
        if (visitDate.isAfter(latest)) {
            throw new IllegalArgumentException(
                    "Visit date " + visitDate + " is more than " + MAX_YEARS_AHEAD + " year ahead (after " + latest
                            + ")");
        }
    }
}
