package victor.training.petclinic.rest;

import java.time.LocalDate;

import org.springframework.stereotype.Component;

import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.rest.error.VisitDateOutOfRangeException;

/**
 * The one place that says when a visit may be scheduled: not before the pet was
 * born, not more than a year out. GitHub issue #40.
 *
 * <p>It cannot be a bean-validation annotation on the DTO. The lower bound is the
 * pet's birth date, and the pet reaches the request only as an id — the mapper
 * builds a stub Pet carrying nothing else — so the rule needs an entity that has
 * been loaded, which is what every caller passes in.
 *
 * <p>Not to be confused with the stricter rule the MCP tools apply
 * ({@code PetClinicMcp.requireFutureDate}): a chatbot may only book today or
 * later, while the REST API still has to accept a vet recording last week's
 * visit. Both are deliberate; neither is the other's fallback.
 */
@Component
public class VisitDateRange {
    private static final int MAX_YEARS_AHEAD = 1;

    public void check(LocalDate date, Pet pet) {
        if (date == null) {
            return;
        }
        LocalDate birthDate = pet.getBirthDate();
        if (birthDate != null && date.isBefore(birthDate)) {
            throw new VisitDateOutOfRangeException(
                    "Visit date must not be before the pet's birth date (" + birthDate + "): " + date);
        }
        LocalDate latest = LocalDate.now().plusYears(MAX_YEARS_AHEAD);
        if (date.isAfter(latest)) {
            throw new VisitDateOutOfRangeException(
                    "Visit date must not be more than " + MAX_YEARS_AHEAD + " year in the future (" + latest + "): "
                            + date);
        }
    }
}
