package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

class OwnerSortTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "name,asc  | ASC  | lastName,firstName,id",
            "name,desc | DESC | lastName,firstName,id",
            "city,asc  | ASC  | city,lastName,firstName,id",
            "city,desc | DESC | city,lastName,firstName,id"})
    void parsesEachAllowedValueIntoItsFullSort(String param, Sort.Direction direction, String properties) {
        Sort expected = Sort.by(direction, properties.split(","));

        assertThat(OwnerSort.parse(param).sort()).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"telephone,asc", "name", "name,up", "NAME,ASC", "name,asc ", "name;drop table owners",
            "pets.name,asc", "city,desc,id"})
    void rejectsEverythingElse(String param) {
        assertThatThrownBy(() -> OwnerSort.parse(param))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("name,asc");
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "city,desc"})
    void everyColumnRunsInTheSameDirection(String param) {
        Sort sort = OwnerSort.parse(param).sort();

        assertThat(sort).extracting(Sort.Order::getDirection).containsOnly(param.endsWith("asc") ? ASC : DESC);
    }
}
