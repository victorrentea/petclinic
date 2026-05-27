package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import victor.training.petclinic.rest.OwnerRestController.SortColumn;

class SortColumnTest {

    @Test
    void name_asc_expandsTo_lastName_firstName_id() {
        Sort sort = SortColumn.NAME.expand(ASC);

        assertThat(sort).containsExactly(
            new Sort.Order(ASC, "lastName"),
            new Sort.Order(ASC, "firstName"),
            new Sort.Order(ASC, "id"));
    }

    @Test
    void name_desc_keepsTiebreakerAscending() {
        Sort sort = SortColumn.NAME.expand(DESC);

        assertThat(sort).containsExactly(
            new Sort.Order(DESC, "lastName"),
            new Sort.Order(DESC, "firstName"),
            new Sort.Order(ASC, "id"));
    }

    @Test
    void city_desc_expandsTo_city_lastName_firstName_id() {
        Sort sort = SortColumn.CITY.expand(DESC);

        assertThat(sort).containsExactly(
            new Sort.Order(DESC, "city"),
            new Sort.Order(DESC, "lastName"),
            new Sort.Order(DESC, "firstName"),
            new Sort.Order(ASC, "id"));
    }

    @Test
    void address_asc_expandsTo_address_lastName_firstName_id() {
        Sort sort = SortColumn.ADDRESS.expand(ASC);

        assertThat(sort).containsExactly(
            new Sort.Order(ASC, "address"),
            new Sort.Order(ASC, "lastName"),
            new Sort.Order(ASC, "firstName"),
            new Sort.Order(ASC, "id"));
    }

    @Test
    void idAsc_isAlwaysTheFinalTiebreaker() {
        for (SortColumn col : SortColumn.values()) {
            for (Sort.Direction dir : Sort.Direction.values()) {
                Sort.Order last = lastOrder(col.expand(dir));
                assertThat(last.getProperty()).as("last property for %s/%s", col, dir).isEqualTo("id");
                assertThat(last.getDirection()).as("last direction for %s/%s", col, dir).isEqualTo(ASC);
            }
        }
    }

    @Test
    void fromClient_acceptsKnownColumns() {
        assertThat(SortColumn.fromClient("name")).isEqualTo(SortColumn.NAME);
        assertThat(SortColumn.fromClient("address")).isEqualTo(SortColumn.ADDRESS);
        assertThat(SortColumn.fromClient("city")).isEqualTo(SortColumn.CITY);
    }

    @Test
    void fromClient_rejectsUnsortableColumn() {
        assertThatThrownBy(() -> SortColumn.fromClient("pets"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void fromClient_rejectsUnknownColumn() {
        assertThatThrownBy(() -> SortColumn.fromClient("telephone"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private static Sort.Order lastOrder(Sort sort) {
        Sort.Order last = null;
        for (Sort.Order o : sort) {
            last = o;
        }
        if (last == null) {
            throw new AssertionError("Sort had no orders");
        }
        return last;
    }
}
