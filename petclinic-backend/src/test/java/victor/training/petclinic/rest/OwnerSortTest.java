package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

class OwnerSortTest {

    @Test
    void nameDefaultsToAscending() {
        assertThat(OwnerSort.parse("name")).isEqualTo(Sort.by(ASC, "lastName", "firstName", "id"));
    }

    @Test
    void nameAscending() {
        assertThat(OwnerSort.parse("name,asc")).isEqualTo(Sort.by(ASC, "lastName", "firstName", "id"));
    }

    @Test
    void nameDescending() {
        assertThat(OwnerSort.parse("name,desc")).isEqualTo(Sort.by(DESC, "lastName", "firstName", "id"));
    }

    @Test
    void cityAscending() {
        assertThat(OwnerSort.parse("city,asc")).isEqualTo(Sort.by(ASC, "city", "lastName", "firstName", "id"));
    }

    @Test
    void cityDescending() {
        assertThat(OwnerSort.parse("city,desc"))
                .isEqualTo(Sort.by(DESC, "city", "lastName", "firstName", "id"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"telephone", "address", "pets", "id", "foo", "", "lastName"})
    void unknownField_isRefused(String field) {
        assertThatThrownBy(() -> OwnerSort.parse(field + ",asc"))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("name or city");
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,up", "city,", "name,asc,desc"})
    void unknownDirection_isRefused(String sort) {
        assertThatThrownBy(() -> OwnerSort.parse(sort))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("asc or desc");
    }
}
