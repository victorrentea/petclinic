package victor.training.petclinic.domain;

import java.time.LocalDate;

/**
 * A visit was booked outside {@link VisitDateRange} (issue #40). Carries both the date and the
 * range so the refusal can say which one it was and what would have been accepted — "invalid
 * date" leaves the caller to guess.
 * <p>
 * In {@code domain} and not in {@code rest.error} because the rule is the domain's, not HTTP's:
 * the MCP tools break it the same way a POST does. Mapping it onto a 400 is the advice's job.
 */
public class VisitDateOutOfRangeException extends RuntimeException {

    public VisitDateOutOfRangeException(LocalDate date, VisitDateRange allowed) {
        super("Visit date must be between the pet's birth date and one year from today ("
                + allowed + "), but was " + date);
    }
}
