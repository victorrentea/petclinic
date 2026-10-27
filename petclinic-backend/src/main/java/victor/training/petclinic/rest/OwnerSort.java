package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.Locale;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * The only orderings {@code GET /api/owners} accepts, each served by an index on {@code owners}.
 * The trailing {@code id} makes the order total, so paging never skips nor repeats an owner.
 */
public enum OwnerSort {
    NAME("lastName", "firstName", "id"), CITY("city", "id");

    private final String[] properties;

    OwnerSort(String... properties) {
        this.properties = properties;
    }

    /** Parses {@code "<name|city>[,asc|desc]"}; the direction applies to every column. */
    public static Sort parse(String sort) {
        String[] parts = sort.split(",", -1);
        if (parts.length > 2) {
            throw invalid(sort);
        }
        OwnerSort key = Arrays.stream(values())
                .filter(candidate -> candidate.name().toLowerCase(Locale.ROOT).equals(parts[0]))
                .findFirst()
                .orElseThrow(() -> invalid(sort));
        Direction direction = parts.length == 1 ? Direction.ASC : parseDirection(parts[1], sort);
        return Sort.by(direction, key.properties);
    }

    private static Direction parseDirection(String direction, String sort) {
        return switch (direction) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw invalid(sort);
        };
    }

    private static ValidationException invalid(String sort) {
        return new ValidationException("Unsupported sort '" + sort + "': use name or city, optionally ,asc or ,desc");
    }
}
