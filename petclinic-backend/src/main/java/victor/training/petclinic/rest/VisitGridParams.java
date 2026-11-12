package victor.training.petclinic.rest;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * The visits grid's paging request, read leniently: a bad param is corrected, never answered
 * with a 400, so the front desk never sees an error page.
 *
 * @param pageable what to query: the page, its size and the JPQL paths to order by
 * @param sort     the sort actually applied, as {@code column,direction}, built from our own constants
 */
record VisitGridParams(Pageable pageable, String sort) {
    private static final List<Integer> PAGE_SIZES = List.of(5, 10, 20);
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final String DEFAULT_SORT = "date,desc";

    /** Grid column → the JPQL paths it orders by, aliased as in {@code VisitRepository.findGridPage}. */
    private static final Map<String, List<String>> COLUMNS = Map.of(
            "date", List.of("v.date"),
            "description", List.of("v.description"),
            "pet", List.of("p.name"),
            "owner", List.of("o.firstName", "o.lastName"));

    static VisitGridParams parse(String page, String size, String sort) {
        String appliedSort = isKnownSort(sort) ? normalize(sort) : DEFAULT_SORT;
        int pageSize = pageSize(size);
        Pageable pageable = PageRequest.of(pageNumber(page, pageSize), pageSize, orderBy(appliedSort));
        return new VisitGridParams(pageable, appliedSort);
    }

    /** At most the page whose offset still fits the int JPA takes; past the end serves the last page anyway. */
    private static int pageNumber(String page, int pageSize) {
        Long requested = parseLong(page);
        return requested == null ? 0 : Math.clamp(requested, 0, Integer.MAX_VALUE / pageSize);
    }

    private static int pageSize(String size) {
        Long requested = parseLong(size);
        if (requested == null) {
            return DEFAULT_PAGE_SIZE;
        }
        long inRange = Math.clamp(requested, PAGE_SIZES.getFirst(), PAGE_SIZES.getLast());
        return PAGE_SIZES.stream()
                .min(Comparator.comparingLong(allowed -> Math.abs(allowed - inRange)))
                .orElseThrow();
    }

    private static Long parseLong(String value) {
        try {
            return value == null ? null : Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean isKnownSort(String sort) {
        if (sort == null) {
            return false;
        }
        String[] parts = sort.split(",", -1);
        return parts.length <= 2 && COLUMNS.containsKey(parts[0])
                && (parts.length == 1 || parts[1].equalsIgnoreCase("asc") || parts[1].equalsIgnoreCase("desc"));
    }

    private static String normalize(String sort) {
        String[] parts = sort.split(",");
        String direction = parts.length == 1 ? "asc" : parts[1].toLowerCase();
        return parts[0] + "," + direction;
    }

    private static Sort orderBy(String appliedSort) {
        String[] parts = appliedSort.split(",");
        Direction direction = Direction.fromString(parts[1]);
        Sort byColumn = Sort.by(direction, COLUMNS.get(parts[0]).toArray(String[]::new));
        return byColumn.and(Sort.by(direction, "v.id"));
    }
}
