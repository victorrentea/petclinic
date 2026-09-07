package victor.training.petclinic.rest.error;

import java.time.LocalDate;

/**
 * A visit may not predate the pet, nor be booked further than a year ahead.
 * The bound depends on the pet being visited, so it cannot be a Bean Validation
 * annotation on the DTO — see GitHub issue #40.
 */
public class VisitDateOutOfRangeException extends RuntimeException {

    public VisitDateOutOfRangeException(LocalDate date, LocalDate earliest, LocalDate latest) {
        super("Visit date " + date + " must be between the pet's birth date (" + earliest
                + ") and one year from now (" + latest + ")");
    }
}
