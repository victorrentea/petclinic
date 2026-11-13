package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.data.domain.Sort.Order.asc;
import static org.springframework.data.domain.Sort.Order.desc;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

class OwnerSortTest {
    @Test
    void nameSortsBySurnameThenFirstNameThenId() {
        assertThat(OwnerSort.parse("name,asc"))
                .isEqualTo(Sort.by(asc("lastName"), asc("firstName"), asc("id")));
    }

    @Test
    void theDirectionAppliesToIdTooSoTheIndexCanBeReadBackward() {
        assertThat(OwnerSort.parse("city,desc")).isEqualTo(Sort.by(desc("city"), desc("id")));
    }

    @Test
    void theDirectionDefaultsToAscending() {
        assertThat(OwnerSort.parse("city")).isEqualTo(Sort.by(asc("city"), asc("id")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"telephone,asc", "address", "pets.name", "name,up", "", "name,asc,city"})
    void anythingElseIsRejected(String sort) {
        assertThatThrownBy(() -> OwnerSort.parse(sort))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("sort");
    }
}
