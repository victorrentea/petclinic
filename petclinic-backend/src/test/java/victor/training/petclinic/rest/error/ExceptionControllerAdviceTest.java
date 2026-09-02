package victor.training.petclinic.rest.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExceptionControllerAdviceTest {

    private final ExceptionControllerAdvice advice = new ExceptionControllerAdvice();

    @Test
    @SuppressWarnings("unchecked")
    void handleConstraintViolation_rendersProblemDetailWithErrors() {
        Path path = mock(Path.class);
        when(path.toString()).thenReturn("telephone");
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("must be numeric");
        when(violation.getInvalidValue()).thenReturn("abc");
        ConstraintViolationException ex = new ConstraintViolationException("failed", Set.of(violation));

        ResponseEntity<ProblemDetail> response = advice.handleConstraintViolation(ex, requestTo("/api/owners"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ProblemDetail pd = response.getBody();
        assertThat(pd).isNotNull();
        assertThat(pd.getTitle()).isEqualTo("Validation Error");
        assertThat(pd.getType()).hasToString("http://localhost/api/owners");
        assertThat(pd.getProperties()).containsKey("timestamp");
        assertThat(pd.getProperties()).extracting("errors")
                .isEqualTo(List.of("Telephone must be numeric (value: abc)"));
    }

    private HttpServletRequest requestTo(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURL()).thenReturn(new StringBuffer("http://localhost" + uri));
        return request;
    }
}
