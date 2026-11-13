package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/**
 * The only orders the owners grid offers. Each ends in id so equal rows keep one order between
 * pages, and the direction applies to id too, so the matching index (V4) can be read backward.
 * Address, telephone and pets are deliberately absent: see gh #25 / Q&A.md.
 */
enum OwnerSort {
    NAME("name", "lastName", "firstName", "id"), CITY("city", "city", "id");

    private final String key;
    private final List<String> properties;

    OwnerSort(String key, String... properties) {
        this.key = key;
        this.properties = List.of(properties);
    }

    /** Parses {@code name|city[,asc|desc]}. */
    static Sort parse(String sortParam) {
        String[] parts = sortParam.split(",", -1);
        if (parts.length > 2) {
            throw invalid(sortParam);
        }
        OwnerSort sort = Arrays.stream(values())
                .filter(candidate -> candidate.key.equals(parts[0]))
                .findFirst()
                .orElseThrow(() -> invalid(sortParam));
        Direction direction = parts.length == 1 ? Direction.ASC : parseDirection(parts[1], sortParam);
        return Sort.by(direction, sort.properties.toArray(String[]::new));
    }

    private static Direction parseDirection(String direction, String sortParam) {
        return switch (direction) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw invalid(sortParam);
        };
    }

    private static ValidationException invalid(String sortParam) {
        return new ValidationException(
                "Unsupported sort '" + sortParam + "': use name or city, optionally followed by ,asc or ,desc");
    }
}
