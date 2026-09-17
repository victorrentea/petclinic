package victor.training.petclinic.rest;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.domain.Sort.Order;

import jakarta.validation.ConstraintViolationException;

/**
 * Expands the two UI-facing sort keys allowed on {@code GET /api/owners} ({@code name}, {@code
 * city}) into JPA property orders, rejecting anything else with a 400 (via the
 * {@code ConstraintViolationException} -> 400 mapping in ExceptionControllerAdvice), and appends
 * an {@code id ASC} tiebreaker so paging stays stable across ties (see design.md Decisions 4 and
 * 5). {@code NULLS LAST} is applied uniformly to every resolved order downstream, in
 * {@link victor.training.petclinic.repository.OwnerRepositoryImpl}.
 */
final class OwnerSortResolver {

    private static final Set<String> ALLOWED_SORT_KEYS = Set.of("name", "city");

    /** The grid drives one column at a time; more terms only grow the ORDER BY for no UI benefit. */
    private static final int MAX_SORT_KEYS = 2;

    private OwnerSortResolver() {
    }

    static Sort resolve(Sort requestedSort) {
        List<Order> orders = new ArrayList<>();
        int requestedKeys = 0;
        for (Order order : requestedSort) {
            if (++requestedKeys > MAX_SORT_KEYS) {
                throw new ConstraintViolationException(
                        "At most " + MAX_SORT_KEYS + " sort keys may be requested", Set.of());
            }
            orders.addAll(expand(order));
        }
        orders.add(Order.asc("id"));
        return Sort.by(orders);
    }

    private static List<Order> expand(Order order) {
        String key = order.getProperty();
        Direction direction = order.getDirection();
        if (key.equals("name")) {
            return List.of(Order.by("lastName").with(direction), Order.by("firstName").with(direction));
        }
        if (key.equals("city")) {
            return List.of(order);
        }
        throw new ConstraintViolationException(
                "Unsupported sort key '" + key + "'. Allowed sort keys: " + ALLOWED_SORT_KEYS, Set.of());
    }
}
