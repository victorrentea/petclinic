package victor.training.petclinic.rest;

import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/** Turns the page, size and sort of {@code GET /api/owners} into a {@link Pageable}, refusing anything else. */
final class OwnerPageRequest {

    private static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);

    // The sort keys are the API's vocabulary, not field names: each one has an index behind it,
    // and id last gives every owner one fixed position, so none repeats or vanishes across pages.
    private static final Map<String, String[]> SORT_KEYS = Map.of(
            "name", new String[]{"firstName", "lastName", "id"},
            "city", new String[]{"city", "firstName", "lastName", "id"});

    private OwnerPageRequest() {
    }

    static Pageable of(int page, int size, String sort) {
        if (page < 0) {
            throw new ValidationException("page must not be negative, was " + page);
        }
        if (!ALLOWED_SIZES.contains(size)) {
            throw new ValidationException("size must be 5, 10 or 20, was " + size);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        String[] fields = keyAndDirection.length == 2 ? SORT_KEYS.get(keyAndDirection[0]) : null;
        if (fields == null) {
            throw new ValidationException("sort must be name or city, then asc or desc, was " + sort);
        }
        return switch (keyAndDirection[1]) {
            case "asc" -> Sort.by(Sort.Direction.ASC, fields);
            case "desc" -> Sort.by(Sort.Direction.DESC, fields);
            default -> throw new ValidationException("sort direction must be asc or desc, was " + sort);
        };
    }
}
