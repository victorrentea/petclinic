package victor.training.petclinic.rest;

import jakarta.validation.ValidationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import static java.util.Objects.requireNonNullElse;

final class OwnerListParameters {
    private OwnerListParameters() {
    }

    static PageRequest pageRequest(String page, String size, String sort) {
        int pageNumber = integer("page", requireNonNullElse(page, "0"));
        int pageSize = integer("size", requireNonNullElse(size, "10"));
        if (pageSize != 5 && pageSize != 10 && pageSize != 20) {
            throw new ValidationException("size must be 5, 10, or 20");
        }
        if (pageNumber < 0 || (long) pageNumber * pageSize > Integer.MAX_VALUE) {
            throw new ValidationException("page must be nonnegative and its offset must fit a 32-bit integer");
        }
        return PageRequest.of(pageNumber, pageSize, sort(requireNonNullElse(sort, "name,asc")));
    }

    private static int integer(String name, String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            throw new ValidationException(name + " must be a 32-bit integer", ex);
        }
    }

    private static Sort sort(String value) {
        String[] parts = value.split(",", -1);
        if (parts.length != 2 || (!parts[1].equals("asc") && !parts[1].equals("desc"))) {
            throw new ValidationException("sort must be name,asc; name,desc; city,asc; or city,desc");
        }
        Sort.Direction direction = parts[1].equals("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        return switch (parts[0]) {
            case "name" -> Sort.by(direction, "lastName", "firstName", "id");
            case "city" -> Sort.by(direction, "city", "lastName", "firstName", "id");
            default -> throw new ValidationException("sort key must be name or city");
        };
    }
}
