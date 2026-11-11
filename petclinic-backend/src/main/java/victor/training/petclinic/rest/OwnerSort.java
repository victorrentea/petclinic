package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.Locale;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * The orders the owners grid offers, named in the API's words ({@code sort=name|city[,asc|desc]}),
 * not the entity's: a client cannot sort on a field this enum does not list. Each expands to the
 * full key of its index (V5), {@code id} last, so owners equal on every visible key keep one order
 * and no owner shows up on two pages.
 */
public enum OwnerSort {
    NAME("lastName", "firstName", "id"), CITY("city", "lastName", "firstName", "id");

    private final String[] properties;

    OwnerSort(String... properties) {
        this.properties = properties;
    }

    /** {@code name}, {@code city,desc}, ...; the direction, ascending by default, applies to every key. */
    public static Sort parse(String sortParam) {
        String[] parts = sortParam.split(",", -1);
        if (parts.length > 2) {
            throw new ValidationException("Sort direction must be asc or desc, not '" + sortParam + "'");
        }
        Direction direction = parts.length == 2 ? direction(parts[1]) : Direction.ASC;
        return Sort.by(direction, field(parts[0]).properties);
    }

    private static OwnerSort field(String name) {
        return Arrays.stream(values())
                .filter(sort -> sort.name().equalsIgnoreCase(name.trim()))
                .findFirst()
                .orElseThrow(() -> new ValidationException(
                        "Owners can be sorted by name or city, not by '" + name + "'"));
    }

    private static Direction direction(String name) {
        return switch (name.trim().toLowerCase(Locale.ROOT)) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw new ValidationException("Sort direction must be asc or desc, not '" + name + "'");
        };
    }
}
