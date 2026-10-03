package victor.training.petclinic.rest;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * The page, size and sort of GET /api/owners, validated as a whole before any query runs. Sort accepts
 * business keys only, never entity property names; the direction applies to every column of the key's chain.
 */
final class OwnerListRequest {
    private static final List<String> SIZES = List.of("5", "10", "20");
    private static final List<String> SORTS = List.of("name,asc", "name,desc", "city,asc", "city,desc");
    private static final Map<String, String[]> SORT_CHAINS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});

    private OwnerListRequest() {
    }

    static PageRequest toPageRequest(String page, String size, String sort) {
        int pageSize = parseSize(size);
        return PageRequest.of(parsePage(page, pageSize), pageSize, parseSort(sort));
    }

    private static int parseSize(String size) {
        if (size == null) {
            return 10;
        }
        if (!SIZES.contains(size)) {
            throw new ValidationException("size must be one of " + SIZES + " (was: " + size + ")");
        }
        return Integer.parseInt(size);
    }

    // The offset Spring Data hands to JDBC is an int, so a page whose offset overflows is rejected too
    private static int parsePage(String page, int size) {
        if (page == null) {
            return 0;
        }
        if (page.matches("\\d{1,10}")) {
            long pageIndex = Long.parseLong(page);
            if (pageIndex * size <= Integer.MAX_VALUE) {
                return (int) pageIndex;
            }
        }
        throw new ValidationException("page must be a zero-based page number (was: " + page + ")");
    }

    private static Sort parseSort(String sort) {
        String requested = sort == null ? SORTS.getFirst() : sort;
        if (!SORTS.contains(requested)) {
            throw new ValidationException("sort must be one of " + SORTS + " (was: " + sort + ")");
        }
        String[] keyAndDirection = requested.split(",");
        return Sort.by(Direction.fromString(keyAndDirection[1]), SORT_CHAINS.get(keyAndDirection[0]));
    }
}
