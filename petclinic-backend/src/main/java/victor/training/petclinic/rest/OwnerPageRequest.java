package victor.training.petclinic.rest;

import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/** Turns the owner list's {@code page}, {@code size} and {@code sort} into a {@link Pageable}, or rejects them. */
final class OwnerPageRequest {
    private static final Set<Integer> SIZES = Set.of(5, 10, 20);

    // A business key, never an entity property; the id makes every order total, so pages never overlap
    private static final Map<String, String[]> SORT_KEYS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});

    private static final Map<String, Direction> DIRECTIONS = Map.of(
            "asc", Direction.ASC,
            "desc", Direction.DESC);

    private OwnerPageRequest() {
    }

    static Pageable of(int page, int size, String sort) {
        if (!SIZES.contains(size)) {
            throw new ValidationException("size must be one of 5, 10, 20, but was " + size);
        }
        if (page < 0 || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("page out of range: " + page);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        if (keyAndDirection.length != 2
                || !SORT_KEYS.containsKey(keyAndDirection[0])
                || !DIRECTIONS.containsKey(keyAndDirection[1])) {
            throw new ValidationException("sort must be name|city,asc|desc, but was " + sort);
        }
        return Sort.by(DIRECTIONS.get(keyAndDirection[1]), SORT_KEYS.get(keyAndDirection[0]));
    }
}
