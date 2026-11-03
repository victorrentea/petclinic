package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.Locale;

import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/** The sort keys of {@code GET /api/owners}, each expanding to a total order ending in the owner id. */
enum OwnerSort {
    NAME("firstName", "lastName", "id"), CITY("city", "firstName", "lastName", "id");

    static final String DEFAULT = "name,asc";

    private final String[] properties;

    OwnerSort(String... properties) {
        this.properties = properties;
    }

    /** @param sort {@code <key>[,<direction>]}, e.g. {@code city,desc} */
    static Sort parse(String sort) {
        String[] parts = sort.split(",", -1);
        if (parts.length > 2) {
            throw invalid(sort);
        }
        OwnerSort key = Arrays.stream(values())
                .filter(candidate -> candidate.name().equalsIgnoreCase(parts[0]))
                .findFirst().orElseThrow(() -> invalid(sort));
        return Sort.by(direction(parts.length == 2 ? parts[1] : "asc", sort), key.properties);
    }

    private static Sort.Direction direction(String direction, String sort) {
        return switch (direction.toLowerCase(Locale.ROOT)) {
            case "asc" -> Sort.Direction.ASC;
            case "desc" -> Sort.Direction.DESC;
            default -> throw invalid(sort);
        };
    }

    private static ValidationException invalid(String sort) {
        return new ValidationException(
                "Invalid sort '" + sort + "': expected name|city, optionally followed by ,asc|,desc");
    }
}
