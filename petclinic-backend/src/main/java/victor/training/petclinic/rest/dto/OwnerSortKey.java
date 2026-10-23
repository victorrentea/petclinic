package victor.training.petclinic.rest.dto;

import java.util.List;

import org.springframework.data.domain.Sort;

/** The only ways the owner grid can be sorted. Lower-case: the constant is the value on the wire. */
public enum OwnerSortKey {
    name("firstName", "lastName", "id"), city("city", "id");

    private final List<String> properties;

    OwnerSortKey(String... properties) {
        this.properties = List.of(properties);
    }

    public Sort toSort(SortDirection direction) {
        return Sort.by(direction.toSpring(), properties.toArray(String[]::new));
    }
}
