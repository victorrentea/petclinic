package victor.training.petclinic.rest.error;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ValidationErrorExtractorTest {

    @Test
    void extract_nullException_returnsEmptyList() {
        assertThat(ValidationErrorExtractor.extract(null)).isEmpty();
    }

    @Test
    void extract_nullViolations_returnsEmptyList() {
        ConstraintViolationException ex = new ConstraintViolationException("msg", null);
        assertThat(ValidationErrorExtractor.extract(ex)).isEmpty();
    }

    @Test
    void extract_simpleField_combinesPathAndMessage() {
        List<String> errors = extractWith("firstName", "must not be blank", "");
        assertThat(errors).containsExactly("First name must not be blank (value: )");
    }

    @Test
    void extract_camelCasePath_splitIntoWords() {
        List<String> errors = extractWith("birthDate", "is required", null);
        assertThat(errors).containsExactly("Birth date is required (value: null)");
    }

    @Test
    void extract_dottedPath_splitIntoWords() {
        List<String> errors = extractWith("pet.name", "must not be empty", "x");
        assertThat(errors).containsExactly("Pet name must not be empty (value: x)");
    }

    @Test
    void extract_messageStartsWithFieldName_usesMessageAsIs() {
        List<String> errors = extractWith("telephone", "telephone must be numeric", "abc");
        assertThat(errors).containsExactly("Telephone must be numeric (value: abc)");
    }

    @Test
    void extract_emptyMessage_usesPathOnly() {
        List<String> errors = extractWith("city", "", "London");
        assertThat(errors).containsExactly("City (value: London)");
    }

    @Test
    void extract_nullPath_usesValueDefault() {
        List<String> errors = extractWith(null, "must not be null", 42);
        assertThat(errors).containsExactly("Value must not be null (value: 42)");
    }

    @SuppressWarnings("unchecked")
    private List<String> extractWith(String pathStr, String message, Object invalidValue) {
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        if (pathStr != null) {
            Path path = mock(Path.class);
            when(path.toString()).thenReturn(pathStr);
            when(violation.getPropertyPath()).thenReturn(path);
        } else {
            when(violation.getPropertyPath()).thenReturn(null);
        }
        when(violation.getMessage()).thenReturn(message);
        when(violation.getInvalidValue()).thenReturn(invalidValue);

        Set<ConstraintViolation<?>> violations = new HashSet<>();
        violations.add(violation);
        ConstraintViolationException ex = new ConstraintViolationException("validation failed", violations);
        return ValidationErrorExtractor.extract(ex);
    }
}
