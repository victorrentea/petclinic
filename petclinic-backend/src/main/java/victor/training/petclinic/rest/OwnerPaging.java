package victor.training.petclinic.rest;

import jakarta.validation.ValidationException;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

/** The only page sizes and sort orders the owners list accepts (#25); anything else is a 400. */
final class OwnerPaging {
    static final Set<Integer> PAGE_SIZES = Set.of(5, 10, 20);

    private OwnerPaging() {
    }

    static PageRequest pageRequest(int page, int size, String sort) {
        if (page < 0) {
            throw new ValidationException("page must be >= 0, was " + page);
        }
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("size must be one of 5, 10, 20, was " + size);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    // Every order ends with id: owners tied on all other keys still have a fixed place,
    // so no owner shows up on two pages or on none.
    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        Direction direction = keyAndDirection.length == 2 ? DIRECTIONS.get(keyAndDirection[1]) : null;
        if (direction == null) {
            throw new ValidationException("sort must be name|city,asc|desc, was " + sort);
        }
        return switch (keyAndDirection[0]) {
            case "name" -> Sort.by(direction, "lastName", "firstName", "id");
            case "city" -> Sort.by(direction, "city").and(Sort.by("lastName", "firstName", "id"));
            default -> throw new ValidationException("sort must be name|city,asc|desc, was " + sort);
        };
    }

    private static final Map<String, Direction> DIRECTIONS = Map.of("asc", Direction.ASC, "desc", Direction.DESC);
}
