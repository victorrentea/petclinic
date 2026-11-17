package victor.training.petclinic.rest;

import jakarta.validation.ValidationException;
import org.springframework.util.MultiValueMap;
import victor.training.petclinic.repository.OwnerSort;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

/** The validated paging, sorting and filter parameters of {@code GET /api/owners}. */
record OwnerListQuery(int page, int size, OwnerSort sort, String lastName) {
    static final Set<Integer> SIZES = Set.of(5, 10, 20);
    static final int DEFAULT_SIZE = 10;

    static OwnerListQuery from(MultiValueMap<String, String> parameters) {
        return new OwnerListQuery(
                parseInt("page", single(parameters, "page"), 0),
                parseSize(single(parameters, "size")),
                parseSort(single(parameters, "sort")),
                parseLastName(single(parameters, "lastName")));
    }

    private static String parseLastName(String value) {
        if (value == null) {
            return "";
        }
        if (value.indexOf('\u0000') >= 0) {
            throw new ValidationException("Parameter 'lastName' must not contain a NUL character");
        }
        return value;
    }

    long offset() {
        return (long) page * size;
    }

    private static String single(MultiValueMap<String, String> parameters, String name) {
        List<String> values = parameters.get(name);
        if (values == null) {
            return null;
        }
        if (values.size() > 1) {
            throw new ValidationException("Parameter '" + name + "' must be given only once");
        }
        return values.get(0);
    }

    private static int parseInt(String name, String value, int defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < 0) {
                throw new NumberFormatException();
            }
            return parsed;
        } catch (NumberFormatException e) {
            throw new ValidationException("Parameter '" + name + "' must be a non-negative integer");
        }
    }

    private static int parseSize(String value) {
        int size = parseInt("size", value, DEFAULT_SIZE);
        if (!SIZES.contains(size)) {
            throw new ValidationException("Parameter 'size' must be one of " + SIZES);
        }
        return size;
    }

    private static OwnerSort parseSort(String value) {
        if (value == null) {
            return OwnerSort.DEFAULT;
        }
        String[] parts = value.split(",", -1);
        if (parts.length != 2) {
            throw new ValidationException("Parameter 'sort' must be <field>,<asc|desc>");
        }
        OwnerSort.Field field = Arrays.stream(OwnerSort.Field.values())
                .filter(candidate -> candidate.apiName().equals(parts[0]))
                .findFirst()
                .orElseThrow(() -> new ValidationException("Unsupported sort field '" + parts[0] + "'"));
        return new OwnerSort(field, parseDirection(parts[1]));
    }

    private static boolean parseDirection(String direction) {
        return switch (direction) {
            case "asc" -> true;
            case "desc" -> false;
            default -> throw new ValidationException("Sort direction must be 'asc' or 'desc'");
        };
    }
}
