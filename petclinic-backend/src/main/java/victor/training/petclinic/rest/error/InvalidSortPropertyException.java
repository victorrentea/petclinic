package victor.training.petclinic.rest.error;

import java.util.Set;

/**
 * The {@code sort} query parameter must be one of a small whitelist of indexed, collation-aware
 * columns — see {@code openspec/changes/add-owners-pagination}. Any other value would let a
 * caller force a full table sort/scan on the (potentially 100k-row) owners table.
 */
public class InvalidSortPropertyException extends RuntimeException {

    public InvalidSortPropertyException(String property, Set<String> allowedProperties) {
        super("Invalid sort property '" + property + "'. Allowed values: " + allowedProperties);
    }
}
