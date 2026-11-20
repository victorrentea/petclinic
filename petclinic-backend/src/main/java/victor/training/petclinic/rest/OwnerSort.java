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
    NAME_ASC("name,asc", byName(ASC)), NAME_DESC("name,desc", byName(DESC)), CITY_ASC("city,asc",
            Sort.by(ASC, "city").and(byName(ASC))), CITY_DESC("city,desc", Sort.by(DESC, "city").and(byName(DESC)));

    public static final String DEFAULT = "name,asc";

    private final String param;
    private final Sort sort;

    OwnerSort(String param, Sort sort) {
        this.param = param;
        this.sort = sort;
    }

    private static Sort byName(Sort.Direction direction) {
        return Sort.by(direction, "lastName", "firstName", "id");
    }

    public static OwnerSort parse(String param) {
        return Arrays.stream(values())
                .filter(value -> value.param.equals(param))
                .findFirst()
                .orElseThrow(() -> new ValidationException("Sort must be one of " + allowed()));
    }

    private static String allowed() {
        return Arrays.stream(values()).map(value -> value.param).collect(Collectors.joining(" | "));
    }

    public Sort sort() {
        return sort;
    }
}
