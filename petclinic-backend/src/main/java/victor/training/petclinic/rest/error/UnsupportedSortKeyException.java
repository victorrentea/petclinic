package victor.training.petclinic.rest.error;

import java.util.List;

/** A list was asked to sort by a key its API does not offer. Rendered as a 400. */
public class UnsupportedSortKeyException extends RuntimeException {

    public UnsupportedSortKeyException(String key, List<String> sortableKeys) {
        super("Cannot sort by '" + key + "'; sortable keys: " + String.join(", ", sortableKeys));
    }
}
