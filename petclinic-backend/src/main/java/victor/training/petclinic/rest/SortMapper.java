package victor.training.petclinic.rest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;

/**
 * Translates a logical, frontend-facing sort key into a safe entity {@link Sort} chain.
 * Only whitelisted keys are honored; anything else falls back to the default Name-ascending
 * ordering, so a request like {@code ?sort=password} cannot leak or order by arbitrary fields.
 * The clicked column flips with the requested direction; tiebreakers always stay ascending.
 */
public final class SortMapper {

    private SortMapper() {
    }

    private record SortKey(List<String> primary, List<String> tiebreakers) {
    }

    private static final String DEFAULT_KEY = "name";

    private static final Map<String, SortKey> WHITELIST = Map.of(
        "name", new SortKey(List.of("lastName", "firstName"), List.of("city", "id")),
        "city", new SortKey(List.of("city"), List.of("lastName", "firstName", "id")));

    public static Sort toEntitySort(Sort requested) {
        for (Sort.Order order : requested) {
            SortKey key = WHITELIST.get(order.getProperty());
            if (key != null) {
                return buildChain(key, order.getDirection());
            }
        }
        return buildChain(WHITELIST.get(DEFAULT_KEY), Sort.Direction.ASC);
    }

    private static Sort buildChain(SortKey key, Sort.Direction direction) {
        List<Sort.Order> orders = new ArrayList<>();
        for (String property : key.primary()) {
            orders.add(new Sort.Order(direction, property));
        }
        for (String property : key.tiebreakers()) {
            orders.add(Sort.Order.asc(property));
        }
        return Sort.by(orders);
    }
}
