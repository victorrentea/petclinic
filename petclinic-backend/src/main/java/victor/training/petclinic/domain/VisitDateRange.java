package victor.training.petclinic.domain;

import java.time.LocalDate;

/**
 * The dates a visit may carry: from the pet's birth to one year from today (issue #40).
 * <p>
 * A value, not a Spring bean, and "today" arrives as an argument instead of being read off a
 * clock inside — so the boundaries are testable without a Clock bean in the context, and the
 * application keeps no way to be told what day it is.
 */
public record VisitDateRange(LocalDate earliest, LocalDate latest) {

    public static final int YEARS_AHEAD = 1;

    /** A pet with no recorded birth date constrains nothing below; the horizon still applies. */
    public static VisitDateRange forPetBornOn(LocalDate birthDate, LocalDate today) {
        return new VisitDateRange(birthDate, today.plusYears(YEARS_AHEAD));
    }

    public boolean allows(LocalDate date) {
        if (date == null) {
            return false;
        }
        boolean afterBirth = earliest == null || !date.isBefore(earliest);
        return afterBirth && !date.isAfter(latest);
    }

    @Override
    public String toString() {
        return (earliest == null ? "any past date" : earliest.toString()) + " … " + latest;
    }
}
