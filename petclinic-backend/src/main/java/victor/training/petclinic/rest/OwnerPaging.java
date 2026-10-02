package victor.training.petclinic.rest;

import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.server.ResponseStatusException;

final class OwnerPaging {
    static final List<Integer> PAGE_SIZES = List.of(5, 10, 20);
    // id last: a unique tie-breaker, else rows with equal keys may repeat or vanish across pages
    private static final Map<String, String[]> SORT_PROPERTIES = Map.of(
            "name", new String[]{"firstName", "lastName", "id"},
            "city", new String[]{"city", "id"});
    private static final Map<String, Sort.Direction> DIRECTIONS = Map.of("asc", ASC, "desc", DESC);

    private OwnerPaging() {
    }

    static Pageable pageable(int page, int size, String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        boolean validSort = keyAndDirection.length == 2
                && SORT_PROPERTIES.containsKey(keyAndDirection[0])
                && DIRECTIONS.containsKey(keyAndDirection[1]);
        if (page < 0 || !PAGE_SIZES.contains(size) || !validSort) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Expected page >= 0, size in " + PAGE_SIZES + ", sort as (name|city),(asc|desc)");
        }
        Sort order = Sort.by(DIRECTIONS.get(keyAndDirection[1]), SORT_PROPERTIES.get(keyAndDirection[0]));
        return PageRequest.of(page, size, order);
    }
}
