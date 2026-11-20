package victor.training.petclinic.rest;

import static org.springframework.data.domain.Sort.Direction.ASC;
import static org.springframework.data.domain.Sort.Direction.DESC;

import java.util.Arrays;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;

import jakarta.validation.ValidationException;

/**
 * The only orders the Owners grid can ask for. Each carries its tie-breakers down to the id, so
 * paging is stable, and every column runs in one direction, so a single index serves both ways.
 */
public enum OwnerSort {
    NAME_ASC("name", ASC), NAME_DESC("name", DESC), CITY_ASC("city", ASC), CITY_DESC("city", DESC);

    public static final String DEFAULT = "name,asc";

    private final String column;
    private final Sort.Direction direction;

    OwnerSort(String column, Sort.Direction direction) {
        this.column = column;
        this.direction = direction;
    }

    public static OwnerSort parse(String param) {
        return Arrays.stream(values())
                .filter(value -> value.param().equals(param))
                .findFirst()
                .orElseThrow(() -> new ValidationException("Sort must be one of " + allowed()));
    }

    private static String allowed() {
        return Arrays.stream(values()).map(OwnerSort::param).collect(Collectors.joining(" | "));
    }

    private String param() {
        return column + "," + direction.name().toLowerCase();
    }

    public Sort sort() {
        Sort byName = Sort.by(direction, "lastName", "firstName", "id");
        return column.equals("city") ? Sort.by(direction, "city").and(byName) : byName;
    }
}
