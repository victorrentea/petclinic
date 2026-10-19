package victor.training.petclinic.domain;

/** A visit dated outside the pet's birth .. one year from today (issue #40). */
public class VisitDateOutOfRangeException extends RuntimeException {
    public VisitDateOutOfRangeException(String message) {
        super(message);
    }
}
