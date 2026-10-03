package victor.training.petclinic.rest;

import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/** Turns the owner-list query parameters into a {@link Pageable}, rejecting anything else with a 400. */
final class OwnerPageRequest {
    static final Set<Integer> PAGE_SIZES = Set.of(5, 10, 20);

    // Business keys, not entity properties; ids break full-name ties so offset pages never overlap.
    private static final Map<String, String[]> SORT_CHAINS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});
    private static final Map<String, Direction> DIRECTIONS = Map.of(
            "asc", Direction.ASC,
            "desc", Direction.DESC);

    private OwnerPageRequest() {
    }

    static Pageable of(int page, int size, String sort) {
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("Page size must be one of 5, 10, 20, got " + size);
        }
        if (page < 0 || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Page must be between 0 and " + Integer.MAX_VALUE / size + ", got " + page);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        if (keyAndDirection.length != 2
                || !SORT_CHAINS.containsKey(keyAndDirection[0])
                || !DIRECTIONS.containsKey(keyAndDirection[1])) {
            throw new ValidationException(
                    "Sort must be one of name,asc name,desc city,asc city,desc, got " + sort);
        }
        return Sort.by(DIRECTIONS.get(keyAndDirection[1]), SORT_CHAINS.get(keyAndDirection[0]));
    }
}
