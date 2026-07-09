package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.web.server.ResponseStatusException;

/** Pure unit test of the owners-list parameter whitelist + sort mapping (no Spring context). */
class OwnerListParamsTest {

    @Test
    void defaults_nameAscending() {
        Pageable pageable = OwnerListParams.toPageable(0, 10, "name", "asc");

        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(10);
        assertThat(pageable.getSort()).containsExactly(
            new Sort.Order(Direction.ASC, "lastName").ignoreCase(),
            new Sort.Order(Direction.ASC, "firstName").ignoreCase(),
            Sort.Order.asc("id"));
    }

    @Test
    void nameSort_isCaseInsensitive_lastThenFirst_tieBrokenById() {
        Sort sort = OwnerListParams.toSort("name", Direction.DESC);

        assertThat(sort.getOrderFor("lastName").isIgnoreCase()).isTrue();
        assertThat(sort.getOrderFor("lastName").getDirection()).isEqualTo(Direction.DESC);
        assertThat(sort.getOrderFor("firstName").isIgnoreCase()).isTrue();
        // id is the deterministic tiebreaker: always ascending, never case-folded
        assertThat(sort.getOrderFor("id").isIgnoreCase()).isFalse();
        assertThat(sort.getOrderFor("id").getDirection()).isEqualTo(Direction.ASC);
    }

    @Test
    void citySort_isCaseInsensitive_tieBrokenById() {
        Sort sort = OwnerListParams.toSort("city", Direction.ASC);

        assertThat(sort.getOrderFor("city").isIgnoreCase()).isTrue();
        assertThat(sort.getOrderFor("city").getDirection()).isEqualTo(Direction.ASC);
        assertThat(sort.getOrderFor("id").getDirection()).isEqualTo(Direction.ASC);
    }

    @Test
    void allowedSizes_accepted() {
        for (int size : new int[]{5, 10, 20}) {
            assertThat(OwnerListParams.toPageable(0, size, "name", "asc").getPageSize()).isEqualTo(size);
        }
    }

    @Test
    void disallowedSize_isBadRequest() {
        assertThatThrownBy(() -> OwnerListParams.toPageable(0, 1_000_000, "name", "asc"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void disallowedSort_isBadRequest() {
        assertThatThrownBy(() -> OwnerListParams.toPageable(0, 10, "address", "asc"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void disallowedDirection_isBadRequest() {
        assertThatThrownBy(() -> OwnerListParams.toPageable(0, 10, "name", "sideways"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void negativePage_isBadRequest() {
        assertThatThrownBy(() -> OwnerListParams.toPageable(-1, 10, "name", "asc"))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void blankDirection_defaultsToAscending() {
        assertThat(OwnerListParams.parseDirection("")).isEqualTo(Direction.ASC);
        assertThat(OwnerListParams.parseDirection(null)).isEqualTo(Direction.ASC);
    }
}
