package victor.training.petclinic.rest;

import jakarta.validation.ConstraintViolationException;

import java.time.LocalDate;
import java.util.Collections;

/**
 * Validates that a visit date falls within the allowed range: not before the pet's birth date
 * (a visit cannot predate the pet) and no more than one year into the future (gh#40).
 * <p>
 * Signals failures with {@link ConstraintViolationException} — the same exception bean-validation raises —
 * so it is mapped to HTTP 400 by the existing global exception handler without coupling the {@code rest}
 * package to {@code rest.error}.
 */
public final class VisitDateValidator {
    static final int MAX_YEARS_IN_FUTURE = 1;

    private VisitDateValidator() {
    }

    public static void validate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            throw violation("Visit date is required");
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw violation("Visit date " + visitDate + " cannot be before the pet's birth date " + petBirthDate);
        }
        LocalDate maxDate = LocalDate.now().plusYears(MAX_YEARS_IN_FUTURE);
        if (visitDate.isAfter(maxDate)) {
            throw violation(
                "Visit date " + visitDate + " cannot be more than one year in the future (after " + maxDate + ")");
        }
    }

    private static ConstraintViolationException violation(String message) {
        return new ConstraintViolationException(message, Collections.emptySet());
    }
}
