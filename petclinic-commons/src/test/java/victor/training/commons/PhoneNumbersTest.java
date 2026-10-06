package victor.training.commons;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class PhoneNumbersTest {
    private static final HomeCountry US = () -> "+1";

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "+1 (608) 555-1023 | +16085551023",
            "(0043)152634418   | +43152634418",
            "6085551023        | 6085551023"})
    void keepsOnlyTheDigitsAndAnInternationalPlus(String typed, String normalized) {
        assertThat(PhoneNumbers.normalize(typed)).isEqualTo(normalized);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "8474461990    | +18474461990",
            "0608 555-1023 | +16085551023",
            "+43152634418  | +43152634418"})
    void givesANationalNumberTheHomeDialCode(String typed, String international) {
        assertThat(PhoneNumbers.normalize(typed, US)).isEqualTo(international);
    }
}
