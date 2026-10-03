package victor.training.petclinic.rest;

import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/** Turns the owner-list query parameters into a {@link Pageable}, rejecting anything outside the whitelist. */
final class OwnerListPaging {
    static final Set<Integer> PAGE_SIZES = Set.of(5, 10, 20);

    // Business sort keys, each mapped to a total order: the id makes every chain unique
    private static final Map<String, String[]> SORT_CHAINS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});
    private static final Map<String, Direction> DIRECTIONS = Map.of(
            "asc", Direction.ASC,
            "desc", Direction.DESC);

    private OwnerListPaging() {
    }

    static Pageable toPageable(int page, int size, String sort) {
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("size must be one of " + PAGE_SIZES + ", was " + size);
        }
        if (page < 0 || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("page out of range: " + page);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        String[] chain = keyAndDirection.length == 2 ? SORT_CHAINS.get(keyAndDirection[0]) : null;
        Direction direction = keyAndDirection.length == 2 ? DIRECTIONS.get(keyAndDirection[1]) : null;
        if (chain == null || direction == null) {
            // Not echoing the value: the message is logged, and a caller's text could forge log lines
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc");
        }
        return Sort.by(direction, chain);
    }
}
