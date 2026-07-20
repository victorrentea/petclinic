package victor.training.petclinic.rest.error;

/**
 * Raised when a visit date falls outside its allowed window (Issue #40):
 * earlier than the pet's birth date, or more than one year in the future.
 * Mapped to HTTP 400 by {@link ExceptionControllerAdvice}.
 */
public class InvalidVisitDateException extends RuntimeException {
    public InvalidVisitDateException(String message) {
        super(message);
    }
}
