package victor.training.petclinic.rest.error;

public class InvalidQueryParameterException extends RuntimeException {
    private final String parameterName;

    public InvalidQueryParameterException(String parameterName, String message) {
        super(message);
        this.parameterName = parameterName;
    }

    public String getParameterName() {
        return parameterName;
    }
}
