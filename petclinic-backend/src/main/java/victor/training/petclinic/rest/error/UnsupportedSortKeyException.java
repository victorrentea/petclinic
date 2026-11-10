package victor.training.petclinic.rest.error;

import java.util.List;

/** A list was asked to sort by a key its API does not offer. Rendered as a 400. */
public class UnsupportedSortKeyException extends RuntimeException {

    public UnsupportedSortKeyException(String key, List<String> sortableKeys) {
        super("Cannot sort by '" + printable(key) + "'; sortable keys: " + String.join(", ", sortableKeys));
    }

    // the key comes from the URL: a CR/LF in it would forge a line in the log this message is written to
    private static String printable(String key) {
        return key.replaceAll("\\p{Cntrl}", "?");
    }
}
