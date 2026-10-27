package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.data.domain.Sort.Order.asc;
import static org.springframework.data.domain.Sort.Order.desc;

import jakarta.validation.ValidationException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class OwnerSortTest {
    @Test
    void name_sortsByLastNameThenFirstNameThenId() {
        assertThat(OwnerSort.parse("name"))
                .isEqualTo(Sort.by(asc("lastName"), asc("firstName"), asc("id")));
    }

    @Test
    void nameDesc_reversesEveryColumnIncludingId() {
        assertThat(OwnerSort.parse("name,desc"))
                .isEqualTo(Sort.by(desc("lastName"), desc("firstName"), desc("id")));
    }

    @Test
    void city_sortsByCityThenId() {
        assertThat(OwnerSort.parse("city")).isEqualTo(Sort.by(asc("city"), asc("id")));
    }

    @Test
    void cityAsc_isTheDefaultDirectionSpelledOut() {
        assertThat(OwnerSort.parse("city,asc")).isEqualTo(Sort.by(asc("city"), asc("id")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"telephone", "name,up", "pets.name", "", "name,asc,desc"})
    void anythingElse_isRejected(String sort) {
        assertThatThrownBy(() -> OwnerSort.parse(sort)).isInstanceOf(ValidationException.class);
    }
}
