package victor.training.petclinic.rest.error;

import org.junit.jupiter.api.Test;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ValidationErrorFieldExtractorTest {

    @Test
    void extract_nullBindingResult_returnsEmptyList() {
        assertThat(ValidationErrorFieldExtractor.extract(null)).isEmpty();
    }

    @Test
    void extract_noErrors_returnsEmptyList() {
        BindingResult br = mock(BindingResult.class);
        when(br.getFieldErrors()).thenReturn(List.of());
        assertThat(ValidationErrorFieldExtractor.extract(br)).isEmpty();
    }

    @Test
    void extract_simpleField_combinesFieldAndMessage() {
        List<String> errors = extractWith("firstName", "must not be blank", "");
        assertThat(errors).containsExactly("First name must not be blank (value: )");
    }

    @Test
    void extract_camelCaseField_splitIntoWords() {
        List<String> errors = extractWith("birthDate", "is required", null);
        assertThat(errors).containsExactly("Birth date is required (value: null)");
    }

    @Test
    void extract_dottedField_splitIntoWords() {
        List<String> errors = extractWith("pet.name", "must not be empty", "x");
        assertThat(errors).containsExactly("Pet name must not be empty (value: x)");
    }

    @Test
    void extract_messageStartsWithFieldName_usesMessageAsIs() {
        List<String> errors = extractWith("telephone", "telephone must be numeric", "abc");
        assertThat(errors).containsExactly("Telephone must be numeric (value: abc)");
    }

    @Test
    void extract_emptyMessage_usesFieldOnly() {
        List<String> errors = extractWith("city", "", "London");
        assertThat(errors).containsExactly("City (value: London)");
    }

    @Test
    void extract_nullMessage_treatedAsEmpty() {
        List<String> errors = extractWith("city", null, "Paris");
        assertThat(errors).containsExactly("City (value: Paris)");
    }

    @Test
    void extract_singleLetterMessage_isCapitalized() {
        List<String> errors = extractWith("x", "x", 1);
        assertThat(errors).containsExactly("X (value: 1)");
    }

    @Test
    void extract_nullField_usesValueDefault() {
        List<String> errors = extractWith(null, "must not be null", 42);
        assertThat(errors).containsExactly("Value must not be null (value: 42)");
    }

    @Test
    void extract_emptyField_usesValueDefault() {
        List<String> errors = extractWith("", "must not be null", 42);
        assertThat(errors).containsExactly("Value must not be null (value: 42)");
    }

    @Test
    void extract_punctuationOnlyField_usesValueDefault() {
        List<String> errors = extractWith(".", "must not be null", 42);
        assertThat(errors).containsExactly("Value must not be null (value: 42)");
    }

    private List<String> extractWith(String field, String message, Object rejectedValue) {
        FieldError fe = mock(FieldError.class);
        when(fe.getField()).thenReturn(field);
        when(fe.getDefaultMessage()).thenReturn(message);
        when(fe.getRejectedValue()).thenReturn(rejectedValue);

        BindingResult br = mock(BindingResult.class);
        when(br.getFieldErrors()).thenReturn(List.of(fe));
        return ValidationErrorFieldExtractor.extract(br);
    }
}
