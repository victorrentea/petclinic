package victor.training.petclinic.rest.error;

/**
 * Thrown when a list request asks to sort by a column that is not exposed as sortable
 * (or with an invalid direction). Rendered as HTTP 400 by {@link ExceptionControllerAdvice}.
 */
public class InvalidSortException extends RuntimeException {
    public InvalidSortException(String message) {
        super(message);
    }
}
