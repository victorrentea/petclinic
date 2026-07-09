package victor.training.petclinic.rest;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.domain.Sort.Order;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Translates the whitelisted owners-list query parameters into a {@link Pageable}, rejecting anything
 * outside the whitelist with 400. Server-side whitelisting (rather than the raw Spring {@code Pageable}
 * resolver) is what lets us pin case-insensitive ordering to the functional indexes, force the {@code id}
 * tiebreaker, and close the DoS holes (unindexed sorts, {@code size=1000000}) on the ~1M-row table.
 */
final class OwnerListParams {

    static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);
    static final Set<String> ALLOWED_SORTS = Set.of("name", "city");

    private OwnerListParams() {
    }

    static Pageable toPageable(int page, int size, String sort, String dir) {
        if (page < 0) {
            throw badRequest("page must be >= 0");
        }
        if (!ALLOWED_SIZES.contains(size)) {
            throw badRequest("size must be one of " + ALLOWED_SIZES);
        }
        return PageRequest.of(page, size, toSort(sort, parseDirection(dir)));
    }

    static Sort toSort(String sort, Direction direction) {
        String key = sort == null ? "" : sort.toLowerCase();
        return switch (key) {
            // Case-insensitive (ignoreCase() renders lower()), always tie-broken by id so a row keeps
            // a stable position across pages. "name" reads last-then-first to match the "Last, First" grid.
            case "name" -> Sort.by(
                new Order(direction, "lastName").ignoreCase(),
                new Order(direction, "firstName").ignoreCase(),
                Order.asc("id"));
            case "city" -> Sort.by(
                new Order(direction, "city").ignoreCase(),
                Order.asc("id"));
            default -> throw badRequest("sort must be one of " + ALLOWED_SORTS);
        };
    }

    static Direction parseDirection(String dir) {
        if (dir == null || dir.isBlank()) {
            return Direction.ASC;
        }
        return switch (dir.toLowerCase()) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw badRequest("dir must be 'asc' or 'desc'");
        };
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
