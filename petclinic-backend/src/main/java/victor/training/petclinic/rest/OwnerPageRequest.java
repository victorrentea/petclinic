package victor.training.petclinic.rest;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * Parses the owner list's paging inputs strictly: an omitted (null) input takes its default, but anything
 * present and not explicitly allowed, including an empty value, is rejected rather than normalized.
 * The messages never echo the input: it lands in the 400 body and in the warn log.
 */
final class OwnerPageRequest {
    static final String DEFAULT_PAGE = "0";
    static final String DEFAULT_SIZE = "10";
    static final String DEFAULT_SORT = "name,asc";
    static final List<Integer> SIZES = List.of(5, 10, 20);
    private static final Map<String, List<String>> SORT_CHAINS = Map.of(
            "name", List.of("lastName", "firstName", "id"),
            "city", List.of("city", "lastName", "firstName", "id"));
    private static final Map<String, Direction> DIRECTIONS = Map.of("asc", Direction.ASC, "desc", Direction.DESC);

    private OwnerPageRequest() {
    }

    static Pageable parse(String page, String size, String sort) {
        int pageIndex = parseInt("page", Objects.requireNonNullElse(page, DEFAULT_PAGE));
        int pageSize = parseInt("size", Objects.requireNonNullElse(size, DEFAULT_SIZE));
        if (pageIndex < 0) {
            throw new ValidationException("page must be zero or positive");
        }
        if (!SIZES.contains(pageSize)) {
            throw new ValidationException("size must be one of " + SIZES);
        }
        if ((long) pageIndex * pageSize > Integer.MAX_VALUE) {
            throw new ValidationException("page is too far for this size");
        }
        return PageRequest.of(pageIndex, pageSize, parseSort(Objects.requireNonNullElse(sort, DEFAULT_SORT)));
    }

    private static Sort parseSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        List<String> chain = keyAndDirection.length == 2 ? SORT_CHAINS.get(keyAndDirection[0]) : null;
        Direction direction = keyAndDirection.length == 2 ? DIRECTIONS.get(keyAndDirection[1]) : null;
        if (chain == null || direction == null) {
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc");
        }
        return Sort.by(direction, chain.toArray(String[]::new));
    }

    private static int parseInt(String name, String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new ValidationException(name + " must be an integer");
        }
    }
}
