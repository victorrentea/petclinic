package victor.training.petclinic.rest;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Enforces the allowed range for a visit date: no earlier than the pet's birth date
 * (a visit can't predate the pet) and no more than one year into the future. Anything
 * outside is rejected with 400, mirroring the whitelist approach in {@link OwnerListParams}.
 * Both bounds are inclusive.
 */
final class VisitDateRange {

    private VisitDateRange() {
    }

    static void validate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            return; // presence is enforced elsewhere; here we only bound a supplied date
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw badRequest("visit date " + visitDate + " cannot be before the pet's birth date " + petBirthDate);
        }
        LocalDate maxDate = LocalDate.now().plusYears(1);
        if (visitDate.isAfter(maxDate)) {
            throw badRequest("visit date " + visitDate
                + " cannot be more than one year in the future (after " + maxDate + ")");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
