package org.springframework.samples.petclinic.rest;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

class OwnerSortTranslationTest {

    private final OwnerRestController controller = new OwnerRestController(
        null, null, null, null, null, null, null, null);

    @Test
    void shouldTranslateNameAscToFirstNameAndLastNameAsc() {
        Pageable input = PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "name"));

        Pageable result = controller.translateSort(input);

        Sort expectedSort = Sort.by(Sort.Direction.ASC, "firstName")
            .and(Sort.by(Sort.Direction.ASC, "lastName"));
        assertThat(result.getSort()).isEqualTo(expectedSort);
        assertThat(result.getPageNumber()).isEqualTo(0);
        assertThat(result.getPageSize()).isEqualTo(10);
    }

    @Test
    void shouldTranslateNameDescToFirstNameAndLastNameDesc() {
        Pageable input = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "name"));

        Pageable result = controller.translateSort(input);

        Sort expectedSort = Sort.by(Sort.Direction.DESC, "firstName")
            .and(Sort.by(Sort.Direction.DESC, "lastName"));
        assertThat(result.getSort()).isEqualTo(expectedSort);
    }

    @Test
    void shouldPassCitySortUnchanged() {
        Pageable input = PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "city"));

        Pageable result = controller.translateSort(input);

        assertThat(result.getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "city"));
    }

    @Test
    void shouldDefaultToFirstNameLastNameAscWhenUnsorted() {
        Pageable input = PageRequest.of(0, 10);

        Pageable result = controller.translateSort(input);

        Sort expectedSort = Sort.by(Sort.Direction.ASC, "firstName")
            .and(Sort.by(Sort.Direction.ASC, "lastName"));
        assertThat(result.getSort()).isEqualTo(expectedSort);
    }
}
