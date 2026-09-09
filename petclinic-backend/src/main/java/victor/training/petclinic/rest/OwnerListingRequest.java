package victor.training.petclinic.rest;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Turns the owner listing's query parameters into a {@link Pageable}.
 *
 * <p>
 * The server owns the sort vocabulary. A client string is never handed to
 * {@code Sort.by} directly: an unknown property would surface as a
 * {@code PropertyReferenceException} - a 500 whose message enumerates the entity's
 * fields. Everything unknown is rejected as {@link IllegalArgumentException}, which
 * {@code ExceptionControllerAdvice} renders as a 400.
 */
final class OwnerListingRequest {
    static final int DEFAULT_PAGE_SIZE = 10;
    static final Set<Integer> OFFERED_PAGE_SIZES = Set.of(5, 10, 20);

    /**
     * The sortable columns, and the entity properties each one orders by. Sorting is
     * offered on name and city only: telephone is free text of mixed formats holding
     * nulls, so its order would be arbitrary, and pets is a collection.
     */
    private enum SortableColumn {
        NAME(List.of("lastName", "firstName")), CITY(List.of("city"));

        private final List<String> properties;

        SortableColumn(List<String> properties) {
            this.properties = properties;
        }
    }

    /**
     * Appended to every sort. Without a unique final key, owners sharing a sort value
     * come back in whatever order the database picked for that query, so one can appear
     * on two pages while another appears on none.
     */
    private static final String TIEBREAK = "id";

    private OwnerListingRequest() {
    }

    static Pageable toPageable(int page, int size, String sort) {
        if (page < 0) {
            throw new IllegalArgumentException("page must not be negative");
        }
        if (!OFFERED_PAGE_SIZES.contains(size)) {
            throw new IllegalArgumentException("size must be one of " + OFFERED_PAGE_SIZES);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] parts = sort.split(",");
        SortableColumn column = parseColumn(parts[0]);
        Sort.Direction direction = parseDirection(parts);
        Sort ordered = Sort.by(direction, column.properties.toArray(String[]::new));
        return ordered.and(Sort.by(direction, TIEBREAK));
    }

    private static SortableColumn parseColumn(String column) {
        try {
            return SortableColumn.valueOf(column.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new IllegalArgumentException("Cannot sort by '" + column.trim() + "'. Sortable columns: "
                    + List.of("name", "city"));
        }
    }

    private static Sort.Direction parseDirection(String[] parts) {
        if (parts.length < 2) {
            return Sort.Direction.ASC;
        }
        return Sort.Direction.fromOptionalString(parts[1].trim())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Cannot sort '" + parts[1].trim() + "'. Use 'asc' or 'desc'."));
    }
}
