package victor.training.petclinic.rest;

import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;

import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/**
 * Turns the raw list query parameters into a {@link Pageable}, rejecting anything else with a 400.
 * Parsed by hand rather than bound to ints: a bad value must be a validation error, not a type mismatch.
 */
final class OwnerPageRequest {
    static final String DEFAULT_PAGE = "0";
    static final String DEFAULT_SIZE = "10";
    static final String DEFAULT_SORT = "name,asc";

    private static final Set<Integer> SIZES = Set.of(5, 10, 20);

    // Business keys, never entity properties. The id ends each chain so pages never overlap.
    private static final Map<String, Sort> SORTS = Map.of(
            "name,asc", Sort.by(ASC, "lastName", "firstName", "id"),
            "name,desc", Sort.by(DESC, "lastName", "firstName", "id"),
            "city,asc", Sort.by(ASC, "city", "lastName", "firstName", "id"),
            "city,desc", Sort.by(DESC, "city", "lastName", "firstName", "id"));

    private OwnerPageRequest() {
    }

    static Pageable parse(String page, String size, String sort) {
        return PageRequest.of(pageIndex(page), pageSize(size), sortOf(sort));
    }

    private static int pageIndex(String page) {
        int index = parseInt("page", page);
        if (index < 0) {
            throw new ValidationException("page must not be negative, was " + page);
        }
        return index;
    }

    private static int pageSize(String size) {
        int parsed = parseInt("size", size);
        if (!SIZES.contains(parsed)) {
            throw new ValidationException("size must be one of 5, 10, 20, was " + size);
        }
        return parsed;
    }

    private static Sort sortOf(String sort) {
        Sort parsed = SORTS.get(sort);
        if (parsed == null) {
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc, was " + sort);
        }
        return parsed;
    }

    private static int parseInt(String name, String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new ValidationException(name + " must be an integer, was " + value);
        }
    }
}
