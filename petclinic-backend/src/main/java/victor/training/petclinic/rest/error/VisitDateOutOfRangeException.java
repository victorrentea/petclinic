package victor.training.petclinic.rest.error;

import java.time.LocalDate;

/**
 * A visit date fell outside [pet birth date .. one year from now].
 * <p>
 * Not expressible as a bean-validation annotation on the DTO: the lower bound comes from the pet
 * the visit points at, so it can only be checked once that pet has been loaded.
 */
public class VisitDateOutOfRangeException extends RuntimeException {

    public VisitDateOutOfRangeException(LocalDate date, LocalDate min, LocalDate max) {
        super("Visit date " + date + " is outside the allowed range [" + min + " .. " + max + "]");
    }
}
