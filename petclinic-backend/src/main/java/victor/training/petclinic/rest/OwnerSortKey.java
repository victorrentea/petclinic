package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/** The only orders the Owners grid offers; the trailing id makes each order total, so pages never overlap. */
enum OwnerSortKey {
    NAME("lastName", "firstName", "id"), CITY("city", "lastName", "firstName", "id");

    private final String[] properties;

    OwnerSortKey(String... properties) {

        this.properties = properties;
    }

    Sort toSort(Sort.Direction direction) {

        return Sort.by(direction, properties);
    }

    static OwnerSortKey parse(String key) {

        return Arrays.stream(values())
                .filter(k -> k.name().equalsIgnoreCase(key))
                .findFirst()
                .orElseThrow(() -> new ValidationException(
                        "Unsupported sort '" + key + "'; supported: " + keys()));
    }

    static Sort.Direction parseDirection(String dir) {

        return Sort.Direction.fromOptionalString(dir)
                .orElseThrow(() -> new ValidationException("Unsupported dir '" + dir + "'; supported: asc, desc"));
    }

    private static String keys() {

        return Arrays.stream(values()).map(k -> k.name().toLowerCase()).collect(Collectors.joining(", "));
    }
}
