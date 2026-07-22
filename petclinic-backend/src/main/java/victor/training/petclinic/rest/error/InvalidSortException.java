package victor.training.petclinic.rest.error;

import java.util.Collection;
import java.util.TreeSet;

import lombok.Getter;

/** Raised when a client asks to sort by a key outside the endpoint's whitelist. */
@Getter
public class InvalidSortException extends RuntimeException {

    private final String rejectedKey;
    private final Collection<String> acceptedKeys;

    public InvalidSortException(String rejectedKey, Collection<String> acceptedKeys) {
        super("Cannot sort by '%s'. Accepted sort keys: %s".formatted(rejectedKey, new TreeSet<>(acceptedKeys)));
        this.rejectedKey = rejectedKey;
        this.acceptedKeys = new TreeSet<>(acceptedKeys);
    }
}
