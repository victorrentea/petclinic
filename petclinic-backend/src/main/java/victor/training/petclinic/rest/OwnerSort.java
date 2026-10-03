package victor.training.petclinic.rest;

import java.util.Arrays;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

import jakarta.validation.ValidationException;

/** The business keys the owners list sorts by; entity property names never reach the API. */
enum OwnerSort {
    NAME("name", "lastName", "firstName", "id"), CITY("city", "city", "lastName", "firstName", "id");

    static final String ALLOWED = "name,asc | name,desc | city,asc | city,desc";

    private final String key;
    private final String[] properties;

    OwnerSort(String key, String... properties) {
        this.key = key;
        this.properties = properties;
    }

    /** Parses exactly "{key},{asc|desc}"; the direction applies to every tie breaker. */
    static Sort parse(String token) {
        String[] parts = token.split(",", -1);
        if (parts.length != 2) {
            throw invalid();
        }
        OwnerSort sort = Arrays.stream(values())
                .filter(s -> s.key.equals(parts[0]))
                .findFirst()
                .orElseThrow(OwnerSort::invalid);
        Direction direction = switch (parts[1]) {
            case "asc" -> Direction.ASC;
            case "desc" -> Direction.DESC;
            default -> throw invalid();
        };
        return Sort.by(direction, sort.properties);
    }

    private static ValidationException invalid() {
        return new ValidationException("sort must be one of " + ALLOWED);
    }
}
