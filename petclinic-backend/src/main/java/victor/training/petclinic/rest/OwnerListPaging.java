package victor.training.petclinic.rest;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/**
 * The paging parameters of GET /api/owners, checked whole: anything outside the documented values is a 400,
 * never silently clamped. Sort keys are business names mapped to a full ORDER BY chain, so entity property
 * names never reach the API, and the direction applies to every column of the chain.
 */
final class OwnerListPaging {
    static final List<Integer> PAGE_SIZES = List.of(5, 10, 20);
    private static final Map<String, String[]> SORT_CHAINS = Map.of(
            "name", new String[]{"lastName", "firstName", "id"},
            "city", new String[]{"city", "lastName", "firstName", "id"});
    private static final List<String> DIRECTIONS = List.of("asc", "desc");

    private OwnerListPaging() {
    }

    static Pageable toPageable(int page, int size, String sort) {
        if (page < 0) {
            throw new ValidationException("page must be 0 or more, was " + page);
        }
        if (!PAGE_SIZES.contains(size)) {
            throw new ValidationException("size must be one of " + PAGE_SIZES + ", was " + size);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] keyAndDirection = sort.split(",", -1);
        String[] chain = keyAndDirection.length == 2 ? SORT_CHAINS.get(keyAndDirection[0]) : null;
        if (chain == null || !DIRECTIONS.contains(keyAndDirection[1])) {
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc, was " + sort);
        }
        return Sort.by(Sort.Direction.fromString(keyAndDirection[1]), chain);
    }
}
