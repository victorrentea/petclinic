package victor.training.petclinic.rest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class VisitGridParamsTest {

    @Test
    void defaultsToTheFirstTenNewestVisits() {
        VisitGridParams params = VisitGridParams.parse(null, null, null);

        assertThat(params.pageable().getPageNumber()).isZero();
        assertThat(params.pageable().getPageSize()).isEqualTo(10);
        assertThat(params.sort()).isEqualTo("date,desc");
    }

    @ParameterizedTest
    @CsvSource({"5,5", "10,10", "20,20", "1,5", "7,5", "8,10", "14,10", "15,10", "16,20", "100,20", "99999999999,20",
            "-9223372036854775808,5",
            "0,5", "-3,5"})
    void snapsSizeToTheNearestAllowedOne(String requested, int served) {
        assertThat(VisitGridParams.parse(null, requested, null).pageable().getPageSize()).isEqualTo(served);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "ten", "1.5"})
    void unreadableSizeServesTen(String requested) {
        assertThat(VisitGridParams.parse(null, requested, null).pageable().getPageSize()).isEqualTo(10);
    }

    @ParameterizedTest
    @CsvSource({"0,0", "3,3", "-1,0", "abc,0", "'',0", "99999999999," + Integer.MAX_VALUE / 10})
    void readsThePageLeniently(String requested, int served) {
        assertThat(VisitGridParams.parse(requested, null, null).pageable().getPageNumber()).isEqualTo(served);
    }

    @ParameterizedTest
    @CsvSource({
            "date,asc,       date,asc",
            "date,desc,      date,desc",
            "description,asc, description,asc",
            "pet,desc,       pet,desc",
            "owner,ASC,      owner,asc",
    })
    void acceptsEveryColumnInBothDirections(String column, String direction, String sortedColumn, String sortedDir) {
        assertThat(VisitGridParams.parse(null, null, column + "," + direction).sort())
                .isEqualTo(sortedColumn + "," + sortedDir);
    }

    @Test
    void aColumnWithoutDirectionSortsAscending() {
        assertThat(VisitGridParams.parse(null, null, "pet").sort()).isEqualTo("pet,asc");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "id,asc", "date,sideways", "Pet,asc", "date,asc,extra", "p.name); drop table x"})
    void anUnknownSortFallsBackToNewestFirst(String sort) {
        assertThat(VisitGridParams.parse(null, null, sort).sort()).isEqualTo("date,desc");
    }

    @Test
    void sortsByTheColumnThenByIdForAStablePaging() {
        Sort sort = VisitGridParams.parse(null, null, "pet,desc").pageable().getSort();

        assertThat(sort.toList()).extracting(Sort.Order::getProperty, Sort.Order::getDirection)
                .containsExactly(
                        tuple("p.name", Sort.Direction.DESC),
                        tuple("v.id", Sort.Direction.DESC));
    }
}
