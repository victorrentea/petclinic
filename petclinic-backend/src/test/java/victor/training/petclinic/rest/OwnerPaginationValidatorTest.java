package victor.training.petclinic.rest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OwnerPaginationValidatorTest {

    @Test
    void toSort_name_asc_mapsToLastNameFirstName() {
        Sort sort = OwnerPaginationValidator.toSort("name", Sort.Direction.ASC);
        assertThat(sort.getOrderFor("lastName")).isNotNull()
                .extracting(Sort.Order::getDirection).isEqualTo(Sort.Direction.ASC);
        assertThat(sort.getOrderFor("firstName")).isNotNull()
                .extracting(Sort.Order::getDirection).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    void toSort_name_desc_mapsToLastNameFirstNameDesc() {
        Sort sort = OwnerPaginationValidator.toSort("name", Sort.Direction.DESC);
        assertThat(sort.getOrderFor("lastName").getDirection()).isEqualTo(Sort.Direction.DESC);
        assertThat(sort.getOrderFor("firstName").getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void toSort_city_mapsToCity() {
        Sort sort = OwnerPaginationValidator.toSort("city", Sort.Direction.ASC);
        assertThat(sort.getOrderFor("city")).isNotNull();
    }

    @Test
    void toSort_invalidKey_throws() {
        assertThatThrownBy(() -> OwnerPaginationValidator.toSort("telephone", Sort.Direction.ASC))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void validatePageParams_allowedSizes_pass(int size) {
        OwnerPaginationValidator.validatePageParams(0, size);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 7, 15, 25, 100})
    void validatePageParams_disallowedSize_throws(int size) {
        assertThatThrownBy(() -> OwnerPaginationValidator.validatePageParams(0, size))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatePageParams_negativePage_throws() {
        assertThatThrownBy(() -> OwnerPaginationValidator.validatePageParams(-1, 10))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void validatePageParams_zeroPage_passes() {
        OwnerPaginationValidator.validatePageParams(0, 10);
    }
}
