package victor.training.petclinic.rest.dto;

import org.springframework.data.domain.Sort;

/** Lower-case: the constant is the value on the wire. */
public enum SortDirection {
    asc, desc;

    Sort.Direction toSpring() {
        return this == asc ? Sort.Direction.ASC : Sort.Direction.DESC;
    }
}
