package victor.training.petclinic.rest;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/** Turns the owner-list query parameters into a {@link Pageable}, rejecting anything outside the contract. */
final class OwnerListRequest {
    static final Set<Integer> PAGE_SIZES = Set.of(5, 10, 20);

    private OwnerListRequest() {
    }

    static Pageable toPageable(int page, int size, String sort) {
        if (page < 0) {
            throw new ValidationException("page must be zero or positive, was " + page);
        }
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("size must be one of 5, 10, 20, was " + size);
        }
        if ((long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("page " + page + " is too far for size " + size);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    // The direction applies to every tie-breaker, so the two ordering indexes serve both directions
    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        if (keyAndDirection.length != 2) {
            throw new ValidationException("sort must be <name|city>,<asc|desc>, was " + sort);
        }
        Direction direction = switch (keyAndDirection[1]) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw new ValidationException("sort direction must be asc or desc, was " + sort);
        };
        return switch (keyAndDirection[0]) {
            case "name" -> Sort.by(direction, "lastName", "firstName", "id");
            case "city" -> Sort.by(direction, "city", "lastName", "firstName", "id");
            default -> throw new ValidationException("sort key must be name or city, was " + sort);
        };
    }
}
