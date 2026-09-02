package victor.training.petclinic.rest.error;

/**
 * A visit date outside {@code VisitDateRange}. Handled by {@link ExceptionControllerAdvice},
 * which renders it as a 400 with the same {@code errors[]} shape bean validation
 * produces, so the frontend has one error format to read, not two.
 */
public class VisitDateOutOfRangeException extends RuntimeException {
    public VisitDateOutOfRangeException(String message) {
        super(message);
    }
}
