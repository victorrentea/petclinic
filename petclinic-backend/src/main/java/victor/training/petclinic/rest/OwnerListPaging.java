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
 * The paging inputs GET /api/owners accepts. Anything else is a 400, never silently corrected.
 * Sorting takes business keys, not entity properties; each key is a full chain ending in the id,
 * so ties never reorder between pages, and the direction applies to every link of the chain.
 */
final class OwnerListPaging {
    static final Set<Integer> SIZES = Set.of(5, 10, 20);

    private static final String[] NAME = {"lastName", "firstName", "id"};
    private static final String[] CITY = {"city", "lastName", "firstName", "id"};
    private static final Map<String, Sort> SORTS = Map.of(
            "name,asc", Sort.by(ASC, NAME),
            "name,desc", Sort.by(DESC, NAME),
            "city,asc", Sort.by(ASC, CITY),
            "city,desc", Sort.by(DESC, CITY));

    private OwnerListPaging() {
    }

    static Pageable pageable(int page, int size, String sort) {
        if (!SIZES.contains(size)) {
            throw new ValidationException("size must be 5, 10 or 20, was " + size);
        }
        // JPA takes the row offset as an int
        if (page < 0 || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("page must be between 0 and " + Integer.MAX_VALUE / size + ", was " + page);
        }
        Sort order = SORTS.get(sort);
        if (order == null) {
            // The raw value is not echoed: it would reach the log and the response unescaped
            throw new ValidationException("sort must be one of name,asc name,desc city,asc city,desc");
        }
        return PageRequest.of(page, size, order);
    }
}
