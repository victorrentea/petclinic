package victor.training.petclinic.rest;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import victor.training.petclinic.rest.error.InvalidSortException;

/**
 * Translates the UI-level sort keys of {@code GET /api/owners} into entity paths.
 * <p>
 * The mapping is closed by construction, which is the point: left to itself Spring Data would
 * resolve whatever the client sends against the entity graph — {@code sort=telephone} throws a
 * PropertyReferenceException (a 500), and {@code sort=pets.visits.description} would quietly emit
 * joins across three tables. Keeping the keys UI-level also decouples the REST contract from the
 * entity model.
 * <p>
 * Every mapping ends in {@code id} so the ORDER BY is total: without a unique tiebreaker, LIMIT/OFFSET
 * paging over a non-unique column may return one owner on two pages and drop another entirely.
 */
final class OwnerSortWhitelist {

    private static final Map<String, List<String>> ENTITY_PATHS_BY_UI_KEY = Map.of(
        "name", List.of("lastName", "firstName", "id"),
        "city", List.of("city", "id"));

    private static final Sort DEFAULT_SORT = Sort.by(Direction.ASC, "lastName", "firstName", "id");

    private OwnerSortWhitelist() {
    }

    static Sort toEntitySort(Sort requestedSort) {
        if (requestedSort.isUnsorted()) {
            return DEFAULT_SORT;
        }
        return requestedSort.stream()
            .map(OwnerSortWhitelist::toEntityOrders)
            .reduce(Sort.unsorted(), Sort::and);
    }

    private static Sort toEntityOrders(Sort.Order requestedOrder) {
        List<String> entityPaths = ENTITY_PATHS_BY_UI_KEY.get(requestedOrder.getProperty());
        if (entityPaths == null) {
            throw new InvalidSortException(requestedOrder.getProperty(), ENTITY_PATHS_BY_UI_KEY.keySet());
        }
        return Sort.by(requestedOrder.getDirection(), entityPaths.toArray(String[]::new));
    }
}
