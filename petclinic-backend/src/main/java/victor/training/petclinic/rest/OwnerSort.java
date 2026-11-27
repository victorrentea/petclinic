package victor.training.petclinic.rest;

import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

/** The only orders the Owners list offers; each ends in id so that ties never shuffle between pages. */
enum OwnerSort {
    name("lastName", "firstName", "id"), city("city", "lastName", "firstName", "id");

    static final String PATTERN = "^(name|city)(,(asc|desc))?$";

    private final String[] properties;

    OwnerSort(String... properties) {
        this.properties = properties;
    }

    /** @param sort a value already matching {@link #PATTERN}, e.g. {@code city,desc} */
    static Sort parse(String sort) {
        String[] parts = sort.split(",");
        Direction direction = parts.length > 1 ? Direction.fromString(parts[1]) : Direction.ASC;
        return Sort.by(direction, valueOf(parts[0]).properties);
    }
}
