package victor.training.petclinic.rest;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * The owner-list query parameters as a {@link PageRequest}. Clients sort by business keys, never by
 * entity properties, and each key expands to a chain ending in the id, so offset pages never tie.
 */
final class OwnerPageRequest {
    static final List<Integer> PAGE_SIZES = List.of(5, 10, 20);
    private static final Map<String, String[]> SORT_CHAINS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});

    private OwnerPageRequest() {
    }

    static PageRequest of(int page, int size, String sort) {
        if (page < 0) {
            throw new ValidationException("page must not be negative");
        }
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("size must be one of " + PAGE_SIZES);
        }
        if ((long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("page is too large");
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        if (keyAndDirection.length != 2 || !SORT_CHAINS.containsKey(keyAndDirection[0])) {
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc");
        }
        Direction direction = switch (keyAndDirection[1]) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw new ValidationException("sort direction must be asc or desc");
        };
        return Sort.by(direction, SORT_CHAINS.get(keyAndDirection[0]));
    }
}
