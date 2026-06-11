package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class SortMapperTest {

    @Test
    void nameAsc_lastThenFirstThenCityThenId_allAscending() {
        Sort result = SortMapper.toEntitySort(Sort.by(Sort.Order.asc("name")));

        assertThat(result).containsExactly(
            Sort.Order.asc("lastName"),
            Sort.Order.asc("firstName"),
            Sort.Order.asc("city"),
            Sort.Order.asc("id"));
    }

    @Test
    void nameDesc_flipsBothNameParts_tiebreakersStayAscending() {
        Sort result = SortMapper.toEntitySort(Sort.by(Sort.Order.desc("name")));

        assertThat(result).containsExactly(
            Sort.Order.desc("lastName"),
            Sort.Order.desc("firstName"),
            Sort.Order.asc("city"),
            Sort.Order.asc("id"));
    }

    @Test
    void cityAsc_cityThenNameThenId_allAscending() {
        Sort result = SortMapper.toEntitySort(Sort.by(Sort.Order.asc("city")));

        assertThat(result).containsExactly(
            Sort.Order.asc("city"),
            Sort.Order.asc("lastName"),
            Sort.Order.asc("firstName"),
            Sort.Order.asc("id"));
    }

    @Test
    void cityDesc_onlyCityFlips_tiebreakersStayAscending() {
        Sort result = SortMapper.toEntitySort(Sort.by(Sort.Order.desc("city")));

        assertThat(result).containsExactly(
            Sort.Order.desc("city"),
            Sort.Order.asc("lastName"),
            Sort.Order.asc("firstName"),
            Sort.Order.asc("id"));
    }

    @Test
    void unknownKey_isRejected_andFallsBackToNameAscending() {
        Sort result = SortMapper.toEntitySort(Sort.by(Sort.Order.asc("password")));

        assertThat(result).containsExactly(
            Sort.Order.asc("lastName"),
            Sort.Order.asc("firstName"),
            Sort.Order.asc("city"),
            Sort.Order.asc("id"));
    }

    @Test
    void unsorted_fallsBackToNameAscending() {
        Sort result = SortMapper.toEntitySort(Sort.unsorted());

        assertThat(result).containsExactly(
            Sort.Order.asc("lastName"),
            Sort.Order.asc("firstName"),
            Sort.Order.asc("city"),
            Sort.Order.asc("id"));
    }
}
