package victor.training.petclinic.rest.error;

import java.util.Collection;
import java.util.TreeSet;

/**
 * A sort instruction named a column that is not sortable, or a direction that is not asc/desc.
 * <p>
 * Rejected rather than ignored: the sort parameter is a property name that would otherwise reach
 * the persistence layer, and silently dropping it would show the user an order they did not ask for.
 */
public class UnsortableColumnException extends RuntimeException {

    public UnsortableColumnException(String requested, Collection<String> allowed) {
        super("Cannot sort by '" + requested + "'. Sortable columns are " + new TreeSet<>(allowed)
                + ", each with direction asc or desc");
    }
}
