package victor.training.petclinic.domain;

/** Thrown by {@link VisitDateRange#check} when a visit date falls outside the allowed window. */
public class VisitDateOutOfRangeException extends RuntimeException {
    public VisitDateOutOfRangeException(String message) {
        super(message);
    }
}
